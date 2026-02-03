/**
 * Layer 5: Synthesis
 * Generate opportunity briefs for clusters
 */

import { generateOpportunityBrief } from '../utils/llm.js';

const BATCH_SIZE = 2;
const MIN_CLUSTER_SIZE = 2; // At least 2 records to synthesize

export async function runSynthesis(env) {
  const stats = { synthesized: 0 };
  
  // Get clusters that need synthesis (no brief or outdated)
  const clustersNeedingSynthesis = await env.DB.prepare(`
    SELECT c.id, c.member_count, c.updated_at
    FROM pain_clusters c
    LEFT JOIN opportunity_briefs b ON b.cluster_id = c.id
    WHERE c.is_active = 1 
      AND c.member_count >= ?
      AND (b.id IS NULL OR b.generated_at < c.updated_at)
    ORDER BY c.member_count DESC
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
      
      // Generate brief using LLM
      const brief = await generateOpportunityBrief(env, records.results);
      
      // Prepare top quotes with URLs
      const topQuotes = records.results.slice(0, 10).map(r => ({
        quote: r.raw_quote || r.problem_statement,
        url: r.reddit_url,
        author: r.author,
        subreddit: r.subreddit,
      }));
      
      // Update cluster name
      if (brief.suggested_name) {
        await env.DB.prepare(`
          UPDATE pain_clusters SET name = ? WHERE id = ?
        `).bind(brief.suggested_name, cluster.id).run();
      }
      
      // Upsert opportunity brief
      const existing = await env.DB.prepare(`
        SELECT id FROM opportunity_briefs WHERE cluster_id = ?
      `).bind(cluster.id).first();
      
      if (existing) {
        await env.DB.prepare(`
          UPDATE opportunity_briefs 
          SET summary = ?, top_quotes = ?, personas = ?, common_workarounds = ?, impact_indicators = ?, generated_at = unixepoch()
          WHERE cluster_id = ?
        `).bind(
          brief.summary,
          JSON.stringify(topQuotes),
          JSON.stringify(brief.common_personas || []),
          JSON.stringify(brief.common_workarounds || []),
          JSON.stringify(brief.impact_indicators || {}),
          cluster.id
        ).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO opportunity_briefs (cluster_id, summary, top_quotes, personas, common_workarounds, impact_indicators)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          cluster.id,
          brief.summary,
          JSON.stringify(topQuotes),
          JSON.stringify(brief.common_personas || []),
          JSON.stringify(brief.common_workarounds || []),
          JSON.stringify(brief.impact_indicators || {})
        ).run();
      }
      
      stats.synthesized++;
    } catch (error) {
      console.error('Synthesis error for cluster', cluster.id, ':', error);
    }
  }
  
  return stats;
}
