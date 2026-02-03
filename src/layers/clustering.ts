// Layer 4: Clustering - Group similar pain points using embeddings

import { Env, PainRecord, PainCluster } from '../types';
import { createEmbedding } from '../utils/openai';
import { getUnclusteredRecords } from './extraction';

const SIMILARITY_THRESHOLD = 0.78;
const BATCH_SIZE = 20;

interface VectorMatch {
  id: string;
  score: number;
  metadata?: { cluster_id?: number; problem_text?: string };
}

async function getOrCreateCluster(env: Env, record: PainRecord, embedding: number[]): Promise<number> {
  const db = env.DB;
  const vectorize = env.VECTORIZE;
  
  let matches: VectorMatch[] = [];
  try {
    const queryResult = await vectorize.query(embedding, { topK: 5, returnMetadata: true });
    matches = (queryResult.matches || []) as VectorMatch[];
  } catch (error) {
    console.log('Vectorize query failed:', error);
  }
  
  let bestMatch: VectorMatch | null = null;
  for (const match of matches) {
    if (match.score >= SIMILARITY_THRESHOLD && match.metadata?.cluster_id) {
      if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
    }
  }
  
  if (bestMatch?.metadata?.cluster_id) {
    const clusterId = bestMatch.metadata.cluster_id;
    await db.prepare(`UPDATE pain_clusters SET member_count = member_count + 1, updated_at = ? WHERE id = ?`)
      .bind(Math.floor(Date.now() / 1000), clusterId).run();
    return clusterId;
  }
  
  // Create new cluster
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO pain_clusters (centroid_text, embedding_id, member_count, unique_authors, subreddit_count, avg_severity, avg_w2p, created_at, updated_at)
    VALUES (?, ?, 1, 1, 1, ?, ?, ?, ?)
  `).bind(record.problem_text, `cluster_${now}_${Math.random().toString(36).slice(2, 8)}`,
    record.severity_score, record.w2p_score, now, now).run();
  
  const idResult = await db.prepare("SELECT id FROM pain_clusters ORDER BY id DESC LIMIT 1")
    .first() as { id: number } | null;
  const clusterId = idResult?.id || 0;
  
  try {
    await vectorize.upsert([{
      id: `pain_${record.id}_${now}`,
      values: embedding,
      metadata: { cluster_id: clusterId, problem_text: record.problem_text.slice(0, 200), subreddit: record.subreddit }
    }]);
  } catch (error) {
    console.error('Failed to upsert to Vectorize:', error);
  }
  
  return clusterId;
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
  
  const existingClusterIds = new Set<number>();
  const clusterResult = await db.prepare("SELECT id FROM pain_clusters").all() as D1Result<{ id: number }>;
  for (const c of clusterResult.results || []) existingClusterIds.add(c.id);
  
  const records = await getUnclusteredRecords(db, BATCH_SIZE);
  
  for (const record of records) {
    if (!record.id || !record.problem_text) continue;
    
    try {
      const embedding = await createEmbedding(env.OPENAI_API_KEY, record.problem_text);
      if (embedding.length === 0) continue;
      
      const clusterId = await getOrCreateCluster(env, record, embedding);
      
      await db.prepare("UPDATE pain_records SET cluster_id = ? WHERE id = ?").bind(clusterId, record.id).run();
      await addToClusterMembers(db, clusterId, record.id, 1.0);
      await updateClusterStats(db, clusterId);
      
      if (existingClusterIds.has(clusterId)) existingUpdated++;
      else { newClusters++; existingClusterIds.add(clusterId); }
      
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
