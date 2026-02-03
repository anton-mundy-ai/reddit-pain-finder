/**
 * Layer 6: Scoring v3
 * Multi-factor ranking of opportunity clusters
 * Uses GPT-5.2 for quality scoring
 */

import { scoreCluster } from '../utils/llm.js';
import { hasAustralianContext } from '../utils/reddit.js';

const BATCH_SIZE = 2;

export async function runScoring(env) {
  const stats = { scored: 0, skipped: 0 };
  
  // Get clusters that need scoring
  const pendingClusters = await env.DB.prepare(`
    SELECT id, member_count, product_name, brief_summary, brief_personas, brief_workarounds, synthesized_at, scored_at
    FROM pain_clusters
    WHERE brief_summary IS NOT NULL
      AND (scored_at IS NULL OR scored_at < synthesized_at)
    ORDER BY member_count DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Scoring] Found ${pendingClusters.results.length} clusters to score`);
  
  for (const cluster of pendingClusters.results) {
    try {
      // Get pain records for context
      const records = await env.DB.prepare(`
        SELECT pr.*
        FROM pain_records pr
        JOIN cluster_members cm ON cm.pain_record_id = pr.id
        WHERE cm.cluster_id = ?
        LIMIT 20
      `).bind(cluster.id).all();
      
      if (records.results.length === 0) {
        console.log(`[Scoring] Cluster ${cluster.id}: no records, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Calculate base metrics
      const uniqueAuthors = new Set(records.results.map(r => r.source_author).filter(Boolean)).size;
      const uniqueSubreddits = new Set(records.results.map(r => r.subreddit)).size;
      const auRecords = records.results.filter(r => 
        hasAustralianContext((r.problem_text || '') + ' ' + (r.context_location || ''), r.subreddit)
      ).length;
      
      // Build brief object
      const brief = {
        product_name: cluster.product_name,
        summary: cluster.brief_summary,
        personas: parseJSON(cluster.brief_personas),
        workarounds: parseJSON(cluster.brief_workarounds),
      };
      
      // Adapt records for LLM
      const adaptedRecords = records.results.map(r => ({
        ...r,
        problem_statement: r.problem_text,
      }));
      
      console.log(`[Scoring] Cluster ${cluster.id}: getting LLM scores...`);
      
      // Get LLM scores (GPT-5.2)
      const llmScores = await scoreCluster(env, brief, adaptedRecords);
      
      // Calculate final scores with boosters
      const frequencyScore = calculateFrequencyScore(
        records.results.length,
        uniqueAuthors,
        uniqueSubreddits,
        llmScores.frequency?.score || 50
      );
      
      const severityScore = llmScores.severity?.score || 50;
      const economicScore = llmScores.economic_value?.score || 50;
      const solvabilityScore = llmScores.solvability?.score || 50;
      const competitiveScore = llmScores.competition?.score || 50;
      
      // AU fit with boost for Australian content
      const auFitBase = llmScores.au_fit?.score || 50;
      const auFitScore = auRecords > 0 
        ? Math.min(100, auFitBase + (auRecords / records.results.length) * 30)
        : auFitBase;
      
      // Total score - weighted combination
      const totalScore = Math.round(
        frequencyScore * 0.15 +
        severityScore * 0.25 +
        economicScore * 0.20 +
        solvabilityScore * 0.15 +
        competitiveScore * 0.10 +
        auFitScore * 0.15
      );
      
      // Store scores in cluster
      await env.DB.prepare(`
        UPDATE pain_clusters SET
          frequency_score = ?,
          severity_score = ?,
          economic_score = ?,
          solvability_score = ?,
          competitive_score = ?,
          au_fit_score = ?,
          total_score = ?,
          scored_at = unixepoch()
        WHERE id = ?
      `).bind(
        frequencyScore,
        severityScore,
        economicScore,
        solvabilityScore,
        competitiveScore,
        auFitScore,
        totalScore,
        cluster.id
      ).run();
      
      stats.scored++;
      console.log(`[Scoring] Cluster ${cluster.id} "${cluster.product_name}": total=${totalScore}`);
      
    } catch (error) {
      console.error(`[Scoring] Error cluster ${cluster.id}:`, error.message);
      stats.skipped++;
    }
  }
  
  console.log(`[Scoring] Scored: ${stats.scored}, Skipped: ${stats.skipped}`);
  return stats;
}

function parseJSON(str) {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

function calculateFrequencyScore(recordCount, uniqueAuthors, uniqueSubreddits, llmScore) {
  let score = llmScore;
  
  // Boost for multiple mentions
  if (recordCount >= 3) score += 5;
  if (recordCount >= 5) score += 5;
  if (recordCount >= 10) score += 10;
  if (recordCount >= 20) score += 10;
  
  // Boost for diverse sources
  if (uniqueAuthors >= 2) score += 5;
  if (uniqueAuthors >= 5) score += 5;
  if (uniqueSubreddits >= 2) score += 5;
  if (uniqueSubreddits >= 3) score += 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Re-score a specific cluster (for back-validation updates)
 */
export async function rescoreCluster(env, clusterId) {
  // Temporarily set scored_at to null to force re-scoring
  await env.DB.prepare(`
    UPDATE pain_clusters SET scored_at = NULL WHERE id = ?
  `).bind(clusterId).run();
  
  // Run scoring for just this cluster
  const result = await runScoring(env);
  return result;
}
