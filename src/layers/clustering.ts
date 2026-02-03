// Layer 4: Clustering - Group similar pain points using LLM-based similarity

import { Env, PainRecord, PainCluster } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getUnclusteredRecords } from './extraction';

const BATCH_SIZE = 15;

// Use LLM to find best matching cluster or suggest new one
const CLUSTERING_PROMPT = `Given a new pain point and existing cluster summaries, determine the best match.

Return JSON:
{
  "best_cluster_id": number or null,
  "confidence": 0-1,
  "reasoning": "brief"
}

If no cluster matches well (confidence < 0.6), return best_cluster_id: null to create a new cluster.
Match based on: same problem domain, similar personas, similar context/industry.`;

async function findBestCluster(
  apiKey: string,
  problemText: string,
  existingClusters: { id: number; centroid_text: string }[]
): Promise<{ clusterId: number | null; confidence: number }> {
  if (existingClusters.length === 0) {
    return { clusterId: null, confidence: 0 };
  }

  const clusterList = existingClusters.slice(0, 20).map(c => 
    `[${c.id}]: ${c.centroid_text.slice(0, 150)}`
  ).join('\n');

  const prompt = `New pain point: "${problemText.slice(0, 300)}"

Existing clusters:
${clusterList}

Find the best matching cluster or return null if no good match.`;

  try {
    const { content } = await callGPT5Nano(apiKey,
      [{ role: 'system', content: CLUSTERING_PROMPT }, { role: 'user', content: prompt }],
      { temperature: 0.1, max_completion_tokens: 100, json_mode: true }
    );
    const result = JSON.parse(content);
    if (result.best_cluster_id && result.confidence >= 0.6) {
      return { clusterId: result.best_cluster_id, confidence: result.confidence };
    }
    return { clusterId: null, confidence: result.confidence || 0 };
  } catch (error) {
    console.error('Clustering LLM error:', error);
    return { clusterId: null, confidence: 0 };
  }
}

async function createCluster(db: D1Database, record: PainRecord): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO pain_clusters (centroid_text, embedding_id, member_count, unique_authors, subreddit_count, avg_severity, avg_w2p, created_at, updated_at)
    VALUES (?, ?, 1, 1, 1, ?, ?, ?, ?)
  `).bind(record.problem_text, `cluster_${now}`, record.severity_score, record.w2p_score, now, now).run();
  
  const idResult = await db.prepare("SELECT id FROM pain_clusters ORDER BY id DESC LIMIT 1").first() as { id: number } | null;
  return idResult?.id || 0;
}

async function addToClusterMembers(db: D1Database, clusterId: number, recordId: number, similarity: number): Promise<void> {
  await db.prepare(`INSERT OR IGNORE INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at) VALUES (?, ?, ?, ?)`)
    .bind(clusterId, recordId, similarity, Math.floor(Date.now() / 1000)).run();
}

async function updateClusterStats(db: D1Database, clusterId: number): Promise<void> {
  await db.prepare(`
    UPDATE pain_clusters SET 
      member_count = (SELECT COUNT(*) FROM cluster_members WHERE cluster_id = ?),
      unique_authors = (SELECT COUNT(DISTINCT pr.source_author) FROM cluster_members cm JOIN pain_records pr ON pr.id = cm.pain_record_id WHERE cm.cluster_id = ?),
      subreddit_count = (SELECT COUNT(DISTINCT pr.subreddit) FROM cluster_members cm JOIN pain_records pr ON pr.id = cm.pain_record_id WHERE cm.cluster_id = ?),
      avg_severity = (SELECT AVG(pr.severity_score) FROM cluster_members cm JOIN pain_records pr ON pr.id = cm.pain_record_id WHERE cm.cluster_id = ?),
      avg_w2p = (SELECT AVG(pr.w2p_score) FROM cluster_members cm JOIN pain_records pr ON pr.id = cm.pain_record_id WHERE cm.cluster_id = ?),
      updated_at = ?
    WHERE id = ?
  `).bind(clusterId, clusterId, clusterId, clusterId, clusterId, Math.floor(Date.now() / 1000), clusterId).run();
}

export async function runClustering(env: Env): Promise<{
  clustered: number;
  new_clusters: number;
  existing_clusters_updated: number;
}> {
  const db = env.DB;
  let clustered = 0, newClusters = 0, existingUpdated = 0;
  
  // Get existing clusters
  const existingClusters = await db.prepare("SELECT id, centroid_text FROM pain_clusters ORDER BY member_count DESC LIMIT 50")
    .all() as D1Result<{ id: number; centroid_text: string }>;
  const clusterList = existingClusters.results || [];
  
  const records = await getUnclusteredRecords(db, BATCH_SIZE);
  
  for (const record of records) {
    if (!record.id || !record.problem_text) continue;
    
    try {
      const { clusterId, confidence } = await findBestCluster(env.OPENAI_API_KEY, record.problem_text, clusterList);
      
      let finalClusterId: number;
      if (clusterId) {
        finalClusterId = clusterId;
        await db.prepare("UPDATE pain_clusters SET member_count = member_count + 1, updated_at = ? WHERE id = ?")
          .bind(Math.floor(Date.now() / 1000), clusterId).run();
        existingUpdated++;
      } else {
        finalClusterId = await createCluster(db, record);
        clusterList.push({ id: finalClusterId, centroid_text: record.problem_text });
        newClusters++;
      }
      
      await db.prepare("UPDATE pain_records SET cluster_id = ? WHERE id = ?").bind(finalClusterId, record.id).run();
      await addToClusterMembers(db, finalClusterId, record.id, confidence);
      await updateClusterStats(db, finalClusterId);
      
      clustered++;
    } catch (error) {
      console.error(`Failed to cluster record ${record.id}:`, error);
    }
  }
  
  return { clustered, new_clusters: newClusters, existing_clusters_updated: existingUpdated };
}

export async function getClustersNeedingSynthesis(db: D1Database, limit: number = 10): Promise<PainCluster[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_clusters WHERE synthesized_at IS NULL OR updated_at > synthesized_at
    ORDER BY member_count DESC LIMIT ?
  `).bind(limit).all() as D1Result<PainCluster>;
  return result.results || [];
}

export async function getClusterMembers(db: D1Database, clusterId: number): Promise<PainRecord[]> {
  const result = await db.prepare(`
    SELECT pr.* FROM pain_records pr JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ? ORDER BY pr.severity_score DESC
  `).bind(clusterId).all() as D1Result<PainRecord>;
  return result.results || [];
}
