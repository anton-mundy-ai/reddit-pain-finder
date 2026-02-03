/**
 * Layer 6: Scoring
 * Multi-factor ranking of opportunity clusters
 */

import { scoreCluster } from '../utils/llm.js';
import { hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 2;

export async function runScoring(env) {
  const stats = { scored: 0 };
  
  // Get clusters that need scoring
  const clustersNeedingScoring = await env.DB.prepare(`
    SELECT c.id, c.member_count, b.summary, b.personas, b.common_workarounds
    FROM pain_clusters c
    JOIN opportunity_briefs b ON b.cluster_id = c.id
    LEFT JOIN cluster_scores s ON s.cluster_id = c.id
    WHERE c.is_active = 1
      AND (s.id IS NULL OR s.calculated_at < b.generated_at)
    ORDER BY c.member_count DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  for (const cluster of clustersNeedingScoring.results) {
    try {
      // Get pain records for this cluster
      const records = await env.DB.prepare(`
        SELECT pr.*
        FROM pain_records pr
        JOIN cluster_members cm ON cm.pain_record_id = pr.id
        WHERE cm.cluster_id = ?
        LIMIT 20
      `).bind(cluster.id).all();
      
      if (records.results.length === 0) continue;
      
      // Calculate base metrics
      const uniqueAuthors = new Set(records.results.map(r => r.source_author).filter(Boolean)).size;
      const uniqueSubreddits = new Set(records.results.map(r => r.subreddit)).size;
      const auRecords = records.results.filter(r => 
        hasAustralianContext((r.problem_text || '') + ' ' + (r.context_location || ''), r.subreddit)
      ).length;
      
      // Adapt records for LLM (use problem_text as problem_statement)
      const adaptedRecords = records.results.map(r => ({
        ...r,
        problem_statement: r.problem_text,
      }));
      
      // Get LLM-based scores
      const brief = {
        summary: cluster.summary,
        common_personas: parseJSON(cluster.personas),
        common_workarounds: parseJSON(cluster.common_workarounds),
      };
      
      const llmScores = await scoreCluster(env, brief, adaptedRecords);
      
      // Calculate final scores
      const frequencyScore = calculateFrequencyScore(
        records.results.length,
        uniqueAuthors,
        uniqueSubreddits,
        llmScores.frequency?.score || 50
      );
      
      const severityScore = llmScores.severity?.score || 50;
      const economicScore = llmScores.economic_value?.score || 50;
      const solvabilityScore = llmScores.solvability?.score || 50;
      const competitionScore = llmScores.competition?.score || 50;
      
      // AU fit - boost if Australian context found
      const auFitBase = llmScores.au_fit?.score || 50;
      const auFitScore = auRecords > 0 
        ? Math.min(100, auFitBase + (auRecords / records.results.length) * 30)
        : auFitBase;
      
      // Total score - weighted combination
      const totalScore = calculateTotalScore({
        frequency: frequencyScore,
        severity: severityScore,
        economic: economicScore,
        solvability: solvabilityScore,
        competition: competitionScore,
        auFit: auFitScore,
      });
      
      // Upsert scores
      const existing = await env.DB.prepare(`
        SELECT id FROM cluster_scores WHERE cluster_id = ?
      `).bind(cluster.id).first();
      
      if (existing) {
        await env.DB.prepare(`
          UPDATE cluster_scores SET
            total_score = ?,
            frequency_score = ?,
            severity_score = ?,
            economic_score = ?,
            solvability_score = ?,
            competition_score = ?,
            au_fit_score = ?,
            calculated_at = unixepoch()
          WHERE cluster_id = ?
        `).bind(
          totalScore,
          frequencyScore,
          severityScore,
          economicScore,
          solvabilityScore,
          competitionScore,
          auFitScore,
          cluster.id
        ).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO cluster_scores (
            cluster_id, total_score,
            frequency_score, severity_score, economic_score,
            solvability_score, competition_score, au_fit_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          cluster.id,
          totalScore,
          frequencyScore,
          severityScore,
          economicScore,
          solvabilityScore,
          competitionScore,
          auFitScore
        ).run();
      }
      
      stats.scored++;
    } catch (error) {
      console.error('Scoring error for cluster', cluster.id, ':', error.message);
    }
  }
  
  return stats;
}

function calculateFrequencyScore(mentions, uniqueAuthors, uniqueSubreddits, llmScore) {
  let score = llmScore;
  
  if (uniqueAuthors >= 5) score += 15;
  else if (uniqueAuthors >= 3) score += 10;
  else if (uniqueAuthors >= 2) score += 5;
  
  if (uniqueSubreddits >= 3) score += 15;
  else if (uniqueSubreddits >= 2) score += 10;
  
  if (mentions >= 10) score += 10;
  else if (mentions >= 5) score += 5;
  
  return Math.min(100, score);
}

function calculateTotalScore(scores) {
  const weights = {
    frequency: 0.15,
    severity: 0.20,
    economic: 0.25,
    solvability: 0.15,
    competition: 0.15,
    auFit: 0.10,
  };
  
  let total = 0;
  total += scores.frequency * weights.frequency;
  total += scores.severity * weights.severity;
  total += scores.economic * weights.economic;
  total += scores.solvability * weights.solvability;
  total += scores.competition * weights.competition;
  total += scores.auFit * weights.auFit;
  
  return Math.round(total);
}

function parseJSON(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}
