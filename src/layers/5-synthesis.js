/**
 * Layer 5: Synthesis
 * Generate opportunity briefs for clusters
 * Adapted to existing database schema (briefs are stored in pain_clusters table)
 */

import { generateOpportunityBrief } from '../utils/llm.js';

const BATCH_SIZE = 2;
const MIN_CLUSTER_SIZE = 2;

export async function runSynthesis(env) {
  const stats = { synthesized: 0 };
  
  // Get clusters that need synthesis (no brief or outdated)
  const clustersNeedingSynthesis = await env.DB.prepare(`
    SELECT id, member_count, updated_at, synthesized_at
    FROM pain_clusters 
    WHERE member_count >= ?
      AND (synthesized_at IS NULL OR synthesized_at < updated_at)
    ORDER BY member_count DESC
    LIMIT ?
  `).bind(MIN_CLUSTER_SIZE, BATCH_SIZE).all();
  
  for (const cluster of clustersNeedingSynthesis.results) {
    try {
      // Get pain records for this cluster
      const records = await env.DB.prepare(`
        SELECT pr.*
        FROM pain_records pr
        JOIN cluster_members cm ON cm.pain_record_id = pr.id
        WHERE cm.cluster_id = ?
        ORDER BY cm.similarity_score DESC
        LIMIT 15
      `).bind(cluster.id).all();
      
      if (records.results.length < MIN_CLUSTER_SIZE) continue;
      
      // Adapt records for the LLM
      const adaptedRecords = records.results.map(r => ({
        ...r,
        problem_statement: r.problem_text,
      }));
      
      // Generate brief using LLM
      const brief = await generateOpportunityBrief(env, adaptedRecords);
      
      // Prepare top quotes
      const topQuotes = records.results.slice(0, 10).map(r => ({
        quote: r.problem_text?.slice(0, 300) || '',
        url: r.source_url,
        author: r.source_author,
        subreddit: r.subreddit,
      }));
      
      // Update cluster with brief (using existing schema columns)
      await env.DB.prepare(`
        UPDATE pain_clusters 
        SET 
          brief_summary = ?,
          brief_quotes = ?,
          brief_personas = ?,
          brief_workarounds = ?,
          synthesized_at = unixepoch()
        WHERE id = ?
      `).bind(
        brief.summary,
        JSON.stringify(topQuotes),
        JSON.stringify(brief.common_personas || []),
        JSON.stringify(brief.common_workarounds || []),
        cluster.id
      ).run();
      
      // Also try to update opportunity_briefs table if it exists
      try {
        const existing = await env.DB.prepare(`
          SELECT id FROM opportunity_briefs WHERE cluster_id = ?
        `).bind(cluster.id).first();
        
        if (existing) {
          await env.DB.prepare(`
            UPDATE opportunity_briefs 
            SET summary = ?, top_quotes = ?, personas = ?, common_workarounds = ?, generated_at = unixepoch()
            WHERE cluster_id = ?
          `).bind(
            brief.summary,
            JSON.stringify(topQuotes),
            JSON.stringify(brief.common_personas || []),
            JSON.stringify(brief.common_workarounds || []),
            cluster.id
          ).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO opportunity_briefs (cluster_id, summary, top_quotes, personas, common_workarounds)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            cluster.id,
            brief.summary,
            JSON.stringify(topQuotes),
            JSON.stringify(brief.common_personas || []),
            JSON.stringify(brief.common_workarounds || [])
          ).run();
        }
      } catch (e) {
        // opportunity_briefs table might not exist, that's okay
      }
      
      stats.synthesized++;
    } catch (error) {
      console.error('Synthesis error for cluster', cluster.id, ':', error.message);
    }
  }
  
  return stats;
}
