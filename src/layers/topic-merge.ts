// Layer 5: Topic Merging v7
// Periodically merges similar topics and clusters using GPT-5.2
// Runs every 6th cron cycle to consolidate fragmented clusters

import { Env } from '../types';
import { callGPT52 } from '../utils/openai';
import { normalizeTopic, groupSimilarTopics } from '../utils/normalize';
import { updateClusterStats, mergeSimularClusters } from './clustering';

/**
 * Get all unique topics from pain records and clusters
 */
async function getAllTopics(db: D1Database): Promise<string[]> {
  const result = await db.prepare(`
    SELECT DISTINCT normalized_topic FROM pain_records 
    WHERE normalized_topic IS NOT NULL
    UNION
    SELECT DISTINCT topic_canonical FROM pain_clusters 
    WHERE topic_canonical IS NOT NULL
  `).all();
  
  return (result.results || [])
    .map((r: any) => r.normalized_topic || r.topic_canonical)
    .filter(Boolean);
}

/**
 * Use GPT-5.2 to identify duplicate/synonym topics
 */
async function identifyDuplicateTopics(
  apiKey: string,
  topics: string[]
): Promise<Map<string, string>> {
  if (topics.length < 2) return new Map();
  
  const prompt = `Analyze these topics from user complaints and identify which ones are duplicates or synonyms that should be merged.

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For each topic that should be merged, output the mapping in this JSON format:
{
  "merges": [
    {"from": "topic to merge away", "to": "canonical topic to keep"},
    ...
  ]
}

Rules:
- Only merge topics that mean essentially the same thing
- Keep the more general/common phrasing as the canonical topic
- Don't merge topics that are merely related but distinct
- Be conservative - if unsure, don't merge

Output ONLY valid JSON.`;

  try {
    const response = await callGPT52(apiKey, [
      { role: 'system', content: 'You are a topic analysis expert. Output only valid JSON.' },
      { role: 'user', content: prompt }
    ], { json_mode: true, max_completion_tokens: 1000 });
    
    const parsed = JSON.parse(response.content);
    const mergeMap = new Map<string, string>();
    
    for (const merge of parsed.merges || []) {
      if (merge.from && merge.to && merge.from !== merge.to) {
        mergeMap.set(merge.from, merge.to);
      }
    }
    
    return mergeMap;
  } catch (error) {
    console.error('Error identifying duplicate topics:', error);
    return new Map();
  }
}

/**
 * Apply topic merges to pain records and clusters
 */
async function applyTopicMerges(
  db: D1Database,
  mergeMap: Map<string, string>
): Promise<number> {
  let updated = 0;
  
  for (const [fromTopic, toTopic] of mergeMap) {
    // Update pain records
    const recordResult = await db.prepare(`
      UPDATE pain_records 
      SET normalized_topic = ?
      WHERE normalized_topic = ?
    `).bind(toTopic, fromTopic).run();
    updated += recordResult.meta.changes || 0;
    
    // Update clusters - merge clusters with the same canonical topic
    const targetCluster = await db.prepare(`
      SELECT id FROM pain_clusters WHERE topic_canonical = ?
    `).bind(toTopic).first() as { id: number } | null;
    
    const sourceCluster = await db.prepare(`
      SELECT id FROM pain_clusters WHERE topic_canonical = ?
    `).bind(fromTopic).first() as { id: number } | null;
    
    if (targetCluster && sourceCluster && targetCluster.id !== sourceCluster.id) {
      // Move all members from source to target
      await db.prepare(`
        UPDATE cluster_members SET cluster_id = ? WHERE cluster_id = ?
      `).bind(targetCluster.id, sourceCluster.id).run();
      
      await db.prepare(`
        UPDATE pain_records SET cluster_id = ? WHERE cluster_id = ?
      `).bind(targetCluster.id, sourceCluster.id).run();
      
      // Delete source cluster
      await db.prepare(`
        DELETE FROM pain_clusters WHERE id = ?
      `).bind(sourceCluster.id).run();
      
      // Update target cluster stats
      await updateClusterStats(db, targetCluster.id);
      
      console.log(`  Merged cluster ${sourceCluster.id} → ${targetCluster.id} (${fromTopic} → ${toTopic})`);
      updated++;
    } else if (!targetCluster && sourceCluster) {
      // Just rename the topic
      await db.prepare(`
        UPDATE pain_clusters SET topic_canonical = ?, topic = ?
        WHERE id = ?
      `).bind(toTopic, toTopic, sourceCluster.id).run();
    }
  }
  
  return updated;
}

/**
 * Run topic merging pass
 * Should be called every 6th cron cycle
 */
export async function runTopicMerge(env: Env): Promise<{
  topics_analyzed: number;
  topics_merged: number;
  clusters_merged: number;
  records_updated: number;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  
  console.log('\n=== v7 Topic Merge Pass ===');
  
  // Get all unique topics
  const allTopics = await getAllTopics(db);
  console.log(`Found ${allTopics.length} unique topics`);
  
  if (allTopics.length < 2) {
    console.log('Not enough topics to merge');
    return { topics_analyzed: 0, topics_merged: 0, clusters_merged: 0, records_updated: 0 };
  }
  
  // Step 1: Rule-based normalization grouping
  const ruleBasedGroups = groupSimilarTopics(allTopics);
  let recordsUpdated = 0;
  
  for (const [canonical, variants] of ruleBasedGroups) {
    if (variants.length > 1) {
      console.log(`  Rule-based: merging ${variants.length} variants → "${canonical}"`);
      for (const variant of variants) {
        if (variant !== canonical) {
          const result = await db.prepare(`
            UPDATE pain_records SET normalized_topic = ? WHERE normalized_topic = ?
          `).bind(canonical, variant).run();
          recordsUpdated += result.meta.changes || 0;
        }
      }
    }
  }
  
  // Step 2: GPT-5.2 analysis for remaining ambiguous cases
  const remainingTopics = [...new Set(allTopics.map(t => normalizeTopic(t)))];
  
  let llmMerged = 0;
  if (remainingTopics.length > 10) {
    console.log(`Analyzing ${remainingTopics.length} normalized topics with GPT-5.2...`);
    const mergeMap = await identifyDuplicateTopics(apiKey, remainingTopics.slice(0, 50));
    
    if (mergeMap.size > 0) {
      console.log(`GPT-5.2 identified ${mergeMap.size} merge opportunities`);
      const updated = await applyTopicMerges(db, mergeMap);
      llmMerged = mergeMap.size;
      recordsUpdated += updated;
    }
  }
  
  // Step 3: Semantic cluster merging (embedding-based)
  console.log('\nRunning semantic cluster merge...');
  const { merged: clustersMerged } = await mergeSimularClusters(env);
  
  console.log(`\n=== Topic Merge Complete ===`);
  console.log(`Topics analyzed: ${allTopics.length}`);
  console.log(`Rule-based merges: ${ruleBasedGroups.size}`);
  console.log(`LLM-identified merges: ${llmMerged}`);
  console.log(`Clusters merged: ${clustersMerged}`);
  console.log(`Records updated: ${recordsUpdated}`);
  
  return {
    topics_analyzed: allTopics.length,
    topics_merged: ruleBasedGroups.size + llmMerged,
    clusters_merged: clustersMerged,
    records_updated: recordsUpdated
  };
}

/**
 * Check if topic merge should run (every 6th cron)
 */
export async function shouldRunTopicMerge(db: D1Database): Promise<boolean> {
  const state = await db.prepare(`
    SELECT value FROM processing_state WHERE key = 'cron_count'
  `).first() as { value: string } | null;
  
  const cronCount = parseInt(state?.value || '0', 10);
  return cronCount % 6 === 0;
}

/**
 * Increment cron counter
 */
export async function incrementCronCount(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  
  await db.prepare(`
    INSERT INTO processing_state (key, value, updated_at)
    VALUES ('cron_count', '0', ?)
    ON CONFLICT(key) DO UPDATE SET 
      value = CAST((CAST(value AS INTEGER) + 1) AS TEXT),
      updated_at = ?
  `).bind(now, now).run();
  
  const state = await db.prepare(`
    SELECT value FROM processing_state WHERE key = 'cron_count'
  `).first() as { value: string } | null;
  
  return parseInt(state?.value || '0', 10);
}
