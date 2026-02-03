// Layer 3: Clustering with SOCIAL PROOF tracking
// v5: Track cluster size, smart re-synthesis trigger

import { Env, PainRecord, PainCluster } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getUnclusteredRecords } from './extraction';

const BATCH_SIZE = 30;  // More aggressive batching
const SIMILARITY_THRESHOLD = 0.65;  // Slightly lower for more aggressive clustering

// v5: Use nano for clustering decisions (fast)
const CLUSTERING_PROMPT = `Match this pain point to the best existing cluster, or suggest creating a new one.

NEW PAIN POINT:
"""
{QUOTE}
"""
Subreddit: r/{SUBREDDIT}

EXISTING CLUSTERS (ID: description):
{CLUSTERS}

Rules:
- Match if the CORE PROBLEM is the same (could be solved by same product)
- Don't match just because same industry
- Match across industries if same frustration

Respond in JSON:
{
  "match_id": number or null,
  "similarity": 0.0-1.0,
  "new_description": "if creating new, 1-sentence problem description"
}`;

interface ClusteringResult {
  match_id: number | null;
  similarity: number;
  new_description: string;
}

interface ExistingCluster {
  id: number;
  centroid_text: string | null;
  social_proof_count: number;
}

async function findBestCluster(
  apiKey: string,
  quote: string,
  subreddit: string,
  existingClusters: ExistingCluster[]
): Promise<ClusteringResult> {
  if (existingClusters.length === 0) {
    return {
      match_id: null,
      similarity: 0,
      new_description: quote.slice(0, 200)
    };
  }

  // Format clusters (top 40 by social proof for context window)
  const clusterList = existingClusters
    .sort((a, b) => b.social_proof_count - a.social_proof_count)
    .slice(0, 40)
    .map(c => `${c.id}: ${c.centroid_text || '(no description)'}`)
    .join('\n');

  const prompt = CLUSTERING_PROMPT
    .replace('{QUOTE}', quote.slice(0, 500))
    .replace('{SUBREDDIT}', subreddit)
    .replace('{CLUSTERS}', clusterList);

  try {
    const { content } = await callGPT5Nano(apiKey,
      [{ role: 'user', content: prompt }],
      { max_completion_tokens: 100, json_mode: true }
    );
    return JSON.parse(content) as ClusteringResult;
  } catch (error) {
    console.error('Clustering error:', error);
    return {
      match_id: null,
      similarity: 0,
      new_description: quote.slice(0, 200)
    };
  }
}

async function createCluster(db: D1Database, centroidText: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  
  await db.prepare(`
    INSERT INTO pain_clusters (
      centroid_text, social_proof_count, last_synth_count, version,
      member_count, unique_authors, subreddit_count, total_upvotes,
      created_at, updated_at
    ) VALUES (?, 0, 0, 1, 0, 0, 0, 0, ?, ?)
  `).bind(centroidText, now, now).run();
  
  const idResult = await db.prepare(
    "SELECT id FROM pain_clusters ORDER BY id DESC LIMIT 1"
  ).first() as { id: number } | null;
  
  return idResult?.id || 0;
}

async function addToCluster(
  db: D1Database, 
  clusterId: number, 
  recordId: number, 
  similarity: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Add to cluster_members
  await db.prepare(`
    INSERT OR IGNORE INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
    VALUES (?, ?, ?, ?)
  `).bind(clusterId, recordId, similarity, now).run();
  
  // Update pain_record with cluster assignment
  await db.prepare(`
    UPDATE pain_records SET cluster_id = ?, cluster_similarity = ? WHERE id = ?
  `).bind(clusterId, similarity, recordId).run();
}

/**
 * v5: Update cluster stats including SOCIAL PROOF COUNT
 */
async function updateClusterStats(db: D1Database, clusterId: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Get all members for this cluster
  const members = await db.prepare(`
    SELECT pr.author, pr.subreddit, pr.source_score, pr.raw_quote
    FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
  `).bind(clusterId).all();
  
  const records = members.results || [];
  const socialProofCount = records.length;
  const uniqueAuthors = new Set(records.map((r: any) => r.author)).size;
  const subreddits = [...new Set(records.map((r: any) => r.subreddit))];
  const subredditCount = subreddits.length;
  const totalUpvotes = records.reduce((sum: number, r: any) => sum + (r.source_score || 0), 0);
  
  // Get top 5 quotes by variety (different authors)
  const seenAuthors = new Set();
  const topQuotes: any[] = [];
  for (const r of records.sort((a: any, b: any) => (b.source_score || 0) - (a.source_score || 0))) {
    if (!seenAuthors.has((r as any).author) && topQuotes.length < 5) {
      topQuotes.push({
        text: ((r as any).raw_quote || '').slice(0, 300),
        author: (r as any).author || 'anonymous',
        subreddit: (r as any).subreddit
      });
      seenAuthors.add((r as any).author);
    }
  }
  
  await db.prepare(`
    UPDATE pain_clusters SET 
      social_proof_count = ?,
      member_count = ?,
      unique_authors = ?,
      subreddit_count = ?,
      total_upvotes = ?,
      subreddits_list = ?,
      top_quotes = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    socialProofCount,
    socialProofCount,  // member_count = social_proof_count
    uniqueAuthors,
    subredditCount,
    totalUpvotes,
    JSON.stringify(subreddits),
    JSON.stringify(topQuotes),
    now,
    clusterId
  ).run();
}

export async function runClustering(env: Env): Promise<{
  clustered: number;
  new_clusters: number;
  existing_clusters_updated: number;
}> {
  const db = env.DB;
  let clustered = 0;
  let newClusters = 0;
  let existingUpdated = 0;
  
  // Get all existing clusters
  const existingClustersResult = await db.prepare(`
    SELECT id, centroid_text, social_proof_count 
    FROM pain_clusters 
    ORDER BY social_proof_count DESC
  `).all() as D1Result<ExistingCluster>;
  
  let existingClusters = existingClustersResult.results || [];
  
  // Get unclustered records
  const records = await getUnclusteredRecords(db, BATCH_SIZE);
  
  console.log(`Clustering ${records.length} records against ${existingClusters.length} clusters...`);
  
  // Track which clusters need stats update
  const updatedClusterIds = new Set<number>();
  
  for (const record of records) {
    if (!record.id) continue;
    
    try {
      const result = await findBestCluster(
        env.OPENAI_API_KEY, 
        record.raw_quote,
        record.subreddit,
        existingClusters
      );
      
      let clusterId: number;
      
      if (result.match_id && result.similarity >= SIMILARITY_THRESHOLD) {
        clusterId = result.match_id;
        existingUpdated++;
      } else {
        clusterId = await createCluster(db, result.new_description);
        existingClusters.push({
          id: clusterId,
          centroid_text: result.new_description,
          social_proof_count: 0
        });
        newClusters++;
      }
      
      await addToCluster(db, clusterId, record.id!, result.similarity);
      updatedClusterIds.add(clusterId);
      clustered++;
      
    } catch (error) {
      console.error(`Failed to cluster record ${record.id}:`, error);
    }
  }
  
  // Update stats for all affected clusters
  console.log(`Updating stats for ${updatedClusterIds.size} clusters...`);
  for (const clusterId of updatedClusterIds) {
    await updateClusterStats(db, clusterId);
  }
  
  console.log(`\n=== Clustering Complete ===`);
  console.log(`Clustered: ${clustered}, New: ${newClusters}, Updated: ${existingUpdated}`);
  
  return { clustered, new_clusters: newClusters, existing_clusters_updated: existingUpdated };
}

/**
 * v5: Get clusters that need synthesis (10% growth threshold)
 */
export async function getClustersNeedingSynthesis(db: D1Database, limit: number = 10): Promise<PainCluster[]> {
  // Get clusters where:
  // 1. Never synthesized (synthesized_at IS NULL)
  // 2. OR has grown by 10%+ since last synthesis
  const result = await db.prepare(`
    SELECT * FROM pain_clusters 
    WHERE social_proof_count >= 1
    AND (
      synthesized_at IS NULL 
      OR (
        last_synth_count > 0 
        AND CAST((social_proof_count - last_synth_count) AS REAL) / last_synth_count >= 0.10
      )
      OR (
        last_synth_count = 0
      )
    )
    ORDER BY social_proof_count DESC 
    LIMIT ?
  `).bind(limit).all() as D1Result<PainCluster>;
  return result.results || [];
}

export async function getClusterMembers(db: D1Database, clusterId: number): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT pr.* FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
    ORDER BY pr.source_score DESC
  `).bind(clusterId).all() as D1Result<PainRecord>;
  return result.results || [];
}
