/**
 * Layer 5: Synthesis v3
 * Generate SNAPPY opportunity briefs for clusters
 * Uses GPT-5.2 for quality output
 * 
 * CRITICAL: Output must be brief and punchy
 * - Product names, not descriptions
 * - 1-2 sentence summaries
 * - Short persona/workaround lists
 */

import { generateOpportunityBrief } from '../utils/llm.js';

const BATCH_SIZE = 2;
const MIN_CLUSTER_SIZE = 1;

export async function runSynthesis(env) {
  const stats = { synthesized: 0, skipped: 0 };
  
  console.log('[Synthesis] Starting...');
  
  // Get clusters needing synthesis
  const pendingClusters = await env.DB.prepare(`
    SELECT id, member_count, centroid_text, updated_at, synthesized_at
    FROM pain_clusters 
    WHERE member_count >= ?
      AND (synthesized_at IS NULL OR synthesized_at < updated_at)
    ORDER BY member_count DESC
    LIMIT ?
  `).bind(MIN_CLUSTER_SIZE, BATCH_SIZE).all();
  
  console.log(`[Synthesis] Found ${pendingClusters.results.length} clusters to synthesize`);
  
  for (const cluster of pendingClusters.results) {
    try {
      // Get pain records for this cluster
      const records = await env.DB.prepare(`
        SELECT pr.*, cm.similarity_score
        FROM pain_records pr
        JOIN cluster_members cm ON cm.pain_record_id = pr.id
        WHERE cm.cluster_id = ?
        ORDER BY cm.similarity_score DESC
        LIMIT 15
      `).bind(cluster.id).all();
      
      if (records.results.length < MIN_CLUSTER_SIZE) {
        console.log(`[Synthesis] Cluster ${cluster.id}: not enough records`);
        stats.skipped++;
        continue;
      }
      
      // Adapt records for LLM (map problem_text -> problem_statement)
      const adaptedRecords = records.results.map(r => ({
        ...r,
        problem_statement: r.problem_text,
      }));
      
      console.log(`[Synthesis] Cluster ${cluster.id}: generating brief from ${records.results.length} records`);
      
      // Generate SNAPPY brief using GPT-5.2
      const brief = await generateOpportunityBrief(env, adaptedRecords);
      
      // Prepare top quotes (brief format)
      const topQuotes = records.results.slice(0, 8).map(r => ({
        quote: (r.problem_text || '').slice(0, 200),
        url: r.source_url,
        author: r.source_author,
        subreddit: r.subreddit,
        score: r.source_score,
      }));
      
      // Get unique subreddits
      const subreddits = [...new Set(records.results.map(r => r.subreddit))];
      
      // Update cluster with synthesis results
      await env.DB.prepare(`
        UPDATE pain_clusters SET
          product_name = ?,
          brief_summary = ?,
          brief_quotes = ?,
          brief_personas = ?,
          brief_workarounds = ?,
          synthesized_at = unixepoch()
        WHERE id = ?
      `).bind(
        brief.product_name || brief.suggested_name || 'Unnamed Opportunity',
        brief.summary,
        JSON.stringify(topQuotes),
        JSON.stringify(brief.personas || brief.common_personas || []),
        JSON.stringify(brief.workarounds || brief.common_workarounds || []),
        cluster.id
      ).run();
      
      stats.synthesized++;
      console.log(`[Synthesis] Cluster ${cluster.id}: "${brief.product_name}" - ${brief.summary?.slice(0, 80)}...`);
      
    } catch (error) {
      console.error(`[Synthesis] Error cluster ${cluster.id}:`, error.message);
      stats.skipped++;
    }
  }
  
  console.log(`[Synthesis] Synthesized: ${stats.synthesized}, Skipped: ${stats.skipped}`);
  return stats;
}

/**
 * Re-synthesize a specific cluster (for back-validation)
 */
export async function resynthesizeCluster(env, clusterId) {
  const cluster = await env.DB.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(clusterId).first();
  
  if (!cluster) {
    throw new Error('Cluster not found');
  }
  
  const records = await env.DB.prepare(`
    SELECT pr.*
    FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
    ORDER BY cm.similarity_score DESC
    LIMIT 20
  `).bind(clusterId).all();
  
  const adaptedRecords = records.results.map(r => ({
    ...r,
    problem_statement: r.problem_text,
  }));
  
  const brief = await generateOpportunityBrief(env, adaptedRecords);
  
  const topQuotes = records.results.slice(0, 10).map(r => ({
    quote: (r.problem_text || '').slice(0, 200),
    url: r.source_url,
    author: r.source_author,
    subreddit: r.subreddit,
  }));
  
  await env.DB.prepare(`
    UPDATE pain_clusters SET
      product_name = ?,
      brief_summary = ?,
      brief_quotes = ?,
      brief_personas = ?,
      brief_workarounds = ?,
      synthesized_at = unixepoch()
    WHERE id = ?
  `).bind(
    brief.product_name || brief.suggested_name,
    brief.summary,
    JSON.stringify(topQuotes),
    JSON.stringify(brief.personas || brief.common_personas || []),
    JSON.stringify(brief.workarounds || brief.common_workarounds || []),
    clusterId
  ).run();
  
  return brief;
}
