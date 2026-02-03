/**
 * Layer 6: Scoring
 * Multi-factor ranking of opportunity clusters
 */

import { scoreCluster } from '../utils/llm.js';
import { hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 10;

export async function runScoring(env) {
  const stats = { scored: 0 };
  
  // Get clusters that need scoring (have briefs but no scores, or outdated)
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
      const uniqueAuthors = new Set(records.results.map(r => r.author).filter(Boolean)).size;
      const uniqueSubreddits = new Set(records.results.map(r => r.subreddit)).size;
      const auRecords = records.results.filter(r => 
        hasAustralianContext(r.problem_statement + ' ' + (r.context_location || ''), r.subreddit)
      ).length;
      
      // Get LLM-based scores
      const brief = {
        summary: cluster.summary,
        common_personas: parseJSON(cluster.personas),
        common_workarounds: parseJSON(cluster.common_workarounds),
      };
      
      const llmScores = await scoreCluster(env, brief, records.results);
      
      // Calculate final scores with adjustments
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
            frequency_score = ?, frequency_details = ?,
            severity_score = ?, severity_details = ?,
            economic_score = ?, economic_details = ?,
            solvability_score = ?, solvability_details = ?,
            competition_score = ?, competition_details = ?,
            au_fit_score = ?, au_fit_details = ?,
            calculated_at = unixepoch()
          WHERE cluster_id = ?
        `).bind(
          totalScore,
          frequencyScore, JSON.stringify({ 
            mentions: records.results.length, 
            uniqueAuthors, 
            uniqueSubreddits,
            llmReasoning: llmScores.frequency?.reasoning 
          }),
          severityScore, JSON.stringify({ reasoning: llmScores.severity?.reasoning }),
          economicScore, JSON.stringify({ reasoning: llmScores.economic_value?.reasoning }),
          solvabilityScore, JSON.stringify({ reasoning: llmScores.solvability?.reasoning }),
          competitionScore, JSON.stringify({ reasoning: llmScores.competition?.reasoning }),
          auFitScore, JSON.stringify({ 
            auRecords, 
            totalRecords: records.results.length,
            reasoning: llmScores.au_fit?.reasoning 
          }),
          cluster.id
        ).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO cluster_scores (
            cluster_id, total_score,
            frequency_score, frequency_details,
            severity_score, severity_details,
            economic_score, economic_details,
            solvability_score, solvability_details,
            competition_score, competition_details,
            au_fit_score, au_fit_details
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          cluster.id,
          totalScore,
          frequencyScore, JSON.stringify({ 
            mentions: records.results.length, 
            uniqueAuthors, 
            uniqueSubreddits,
            llmReasoning: llmScores.frequency?.reasoning 
          }),
          severityScore, JSON.stringify({ reasoning: llmScores.severity?.reasoning }),
          economicScore, JSON.stringify({ reasoning: llmScores.economic_value?.reasoning }),
          solvabilityScore, JSON.stringify({ reasoning: llmScores.solvability?.reasoning }),
          competitionScore, JSON.stringify({ reasoning: llmScores.competition?.reasoning }),
          auFitScore, JSON.stringify({ 
            auRecords, 
            totalRecords: records.results.length,
            reasoning: llmScores.au_fit?.reasoning 
          })
        ).run();
      }
      
      stats.scored++;
    } catch (error) {
      console.error('Scoring error for cluster', cluster.id, ':', error);
    }
  }
  
  return stats;
}

function calculateFrequencyScore(mentions, uniqueAuthors, uniqueSubreddits, llmScore) {
  // Base: LLM assessment
  let score = llmScore;
  
  // Boost for unique authors (real signal, not one person spamming)
  if (uniqueAuthors >= 5) score += 15;
  else if (uniqueAuthors >= 3) score += 10;
  else if (uniqueAuthors >= 2) score += 5;
  
  // Boost for cross-subreddit presence
  if (uniqueSubreddits >= 3) score += 15;
  else if (uniqueSubreddits >= 2) score += 10;
  
  // Boost for volume
  if (mentions >= 10) score += 10;
  else if (mentions >= 5) score += 5;
  
  return Math.min(100, score);
}

function calculateTotalScore(scores) {
  // Weighted formula
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
