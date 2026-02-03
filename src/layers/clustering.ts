// Layer 4: EMBEDDING-BASED Clustering v7
// Uses semantic similarity via text-embedding-3-small
// Clusters pain points by meaning, not just topic strings

import { Env, PainRecord, PainCluster } from '../types';
import { 
  generateEmbedding, 
  storeEmbedding, 
  findSimilarRecords,
  cosineSimilarity,
  getAllEmbeddings 
} from '../utils/embeddings';
import { 
  normalizeTopic, 
  extractBroadCategory,
  topicsMatch 
} from '../utils/normalize';
import { getUnclusteredRecords } from './extraction';

const SIMILARITY_THRESHOLD = 0.65;  // v8: Higher threshold for quality clusters
const MIN_CLUSTER_SIZE = 3;         // Minimum records to form a real cluster

/**
 * Get or create a cluster for semantically similar pain points
 */
async function getOrCreateSemanticCluster(
  db: D1Database,
  apiKey: string,
  record: PainRecord,
  embedding: number[]
): Promise<{ clusterId: number; similarity: number }> {
  const now = Math.floor(Date.now() / 1000);
  
  // Parse the record's topics
  let topics: string[] = [];
  try {
    topics = record.topics ? JSON.parse(record.topics) : [];
  } catch {}
  
  const primaryTopic = topics[0] || 'general';
  const normalizedTopic = normalizeTopic(primaryTopic);
  const broadCategory = extractBroadCategory(primaryTopic);
  
  // Find similar existing records
  const similar = await findSimilarRecords(
    db, 
    embedding, 
    record.id || 0, 
    10,
    SIMILARITY_THRESHOLD
  );
  
  // Filter to same broad category for tighter clusters
  const relevantSimilar = similar.filter(s => {
    if (!s.normalized_topic) return true;
    const sCategory = extractBroadCategory(s.normalized_topic);
    return sCategory === broadCategory || sCategory === 'general' || broadCategory === 'general';
  });
  
  // Check if any similar record has a cluster
  for (const sim of relevantSimilar) {
    if (sim.cluster_id && sim.similarity >= SIMILARITY_THRESHOLD) {
      // Join existing cluster
      console.log(`  → Joining cluster ${sim.cluster_id} (similarity: ${sim.similarity.toFixed(3)})`);
      return { clusterId: sim.cluster_id, similarity: sim.similarity };
    }
  }
  
  // No suitable cluster found - create new one
  await db.prepare(`
    INSERT INTO pain_clusters (
      topic, topic_canonical, broad_category, centroid_text, 
      social_proof_count, last_synth_count, version,
      member_count, unique_authors, subreddit_count, total_upvotes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, 0, 1, 0, 0, 0, 0, ?, ?)
  `).bind(
    primaryTopic,
    normalizedTopic,
    broadCategory,
    `Pain points about: ${normalizedTopic}`,
    now,
    now
  ).run();
  
  const newCluster = await db.prepare(
    "SELECT id FROM pain_clusters WHERE topic_canonical = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(normalizedTopic).first() as { id: number } | null;
  
  const clusterId = newCluster?.id || 0;
  console.log(`  → Created new cluster ${clusterId} for "${normalizedTopic}"`);
  
  return { clusterId, similarity: 1.0 };
}

/**
 * Add a pain record to a cluster
 */
async function addToCluster(
  db: D1Database, 
  clusterId: number, 
  recordId: number,
  similarity: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Add to cluster_members
  await db.prepare(`
    INSERT OR REPLACE INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
    VALUES (?, ?, ?, ?)
  `).bind(clusterId, recordId, similarity, now).run();
  
  // Update pain_record
  await db.prepare(`
    UPDATE pain_records SET cluster_id = ?, cluster_similarity = ? WHERE id = ?
  `).bind(clusterId, similarity, recordId).run();
}

/**
 * Deduplicate similar personas (e.g., "australian_voter" and "australian_citizen" → just "australian_voter")
 */
function deduplicatePersonas(personas: string[], maxPersonas: number = 5): string[] {
  if (personas.length <= 1) return personas;
  
  // Normalize and group similar personas
  const normalized = personas.map(p => ({
    original: p,
    words: new Set(p.toLowerCase().split('_').filter(w => w.length > 2))
  }));
  
  const deduplicated: string[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < normalized.length; i++) {
    if (used.has(i)) continue;
    
    // Find best (shortest) persona in this similarity group
    let bestIdx = i;
    let bestLen = normalized[i].original.length;
    
    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(j)) continue;
      
      // Check word overlap
      const overlap = [...normalized[i].words].filter(w => normalized[j].words.has(w)).length;
      const minWords = Math.min(normalized[i].words.size, normalized[j].words.size);
      
      // If >50% overlap, consider them similar
      if (minWords > 0 && overlap / minWords >= 0.5) {
        used.add(j);
        if (normalized[j].original.length < bestLen) {
          bestIdx = j;
          bestLen = normalized[j].original.length;
        }
      }
    }
    
    deduplicated.push(normalized[bestIdx].original);
    used.add(i);
    
    if (deduplicated.length >= maxPersonas) break;
  }
  
  return deduplicated;
}

/**
 * Update cluster stats after membership changes
 */
export async function updateClusterStats(db: D1Database, clusterId: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Get all member data
  const members = await db.prepare(`
    SELECT pr.author, pr.subreddit, pr.source_score, pr.raw_quote, pr.persona, pr.severity, cm.similarity_score
    FROM pain_records pr
    JOIN cluster_members cm ON cm.pain_record_id = pr.id
    WHERE cm.cluster_id = ?
    ORDER BY cm.similarity_score DESC
  `).bind(clusterId).all();
  
  const records = members.results || [];
  const socialProofCount = records.length;
  
  // v8: Properly calculate unique authors (filter out null/undefined)
  const authorSet = new Set<string>();
  let totalUpvotes = 0;
  for (const r of records) {
    const author = (r as any).author;
    if (author && author !== '[deleted]' && author !== 'AutoModerator') {
      authorSet.add(author);
    }
    totalUpvotes += (r as any).source_score || 0;
  }
  const uniqueAuthors = authorSet.size;
  
  const subreddits = [...new Set(records.map((r: any) => r.subreddit))];
  const subredditCount = subreddits.length;
  
  // v8: Deduplicate personas
  const allPersonas = [...new Set(records.map((r: any) => r.persona).filter(Boolean))];
  const personas = deduplicatePersonas(allPersonas, 5);
  
  // Get severity breakdown
  const severityCounts: Record<string, number> = {};
  for (const r of records) {
    const sev = (r as any).severity || 'medium';
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;
  }
  
  // Get top 5 quotes by variety (different authors, highest similarity)
  const seenAuthors = new Set();
  const topQuotes: any[] = [];
  for (const r of records) {
    if (!seenAuthors.has((r as any).author) && topQuotes.length < 5) {
      topQuotes.push({
        text: ((r as any).raw_quote || '').slice(0, 300),
        author: (r as any).author || 'anonymous',
        subreddit: (r as any).subreddit,
        persona: (r as any).persona,
        severity: (r as any).severity,
        similarity: (r as any).similarity_score
      });
      seenAuthors.add((r as any).author);
    }
  }
  
  // Calculate average similarity (cluster cohesion)
  const avgSimilarity = records.length > 0
    ? records.reduce((sum: number, r: any) => sum + ((r as any).similarity_score || 0), 0) / records.length
    : 0;
  
  await db.prepare(`
    UPDATE pain_clusters SET 
      social_proof_count = ?,
      member_count = ?,
      unique_authors = ?,
      subreddit_count = ?,
      total_upvotes = ?,
      subreddits_list = ?,
      top_quotes = ?,
      categories = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    socialProofCount,
    socialProofCount,
    uniqueAuthors,
    subredditCount,
    totalUpvotes,
    JSON.stringify(subreddits),
    JSON.stringify(topQuotes),
    JSON.stringify({ personas, severity: severityCounts, avgSimilarity }),
    now,
    clusterId
  ).run();
}

/**
 * Main clustering function - processes unclustered records
 */
export async function runClustering(env: Env): Promise<{
  clustered: number;
  embeddings_generated: number;
  clusters_updated: number;
  clusters_created: number;
}> {
  const db = env.DB;
  const apiKey = env.OPENAI_API_KEY;
  let clustered = 0;
  let embeddingsGenerated = 0;
  let clustersCreated = 0;
  const clustersUpdated = new Set<number>();
  
  // Get records that have topics but no cluster
  const records = await getUnclusteredRecords(db, 50);
  
  console.log(`\n=== v7 Semantic Clustering ===`);
  console.log(`Processing ${records.length} untagged pain points...`);
  
  for (const record of records) {
    if (!record.id || !record.topics) continue;
    
    try {
      // Generate embedding for the raw quote
      const text = record.raw_quote || '';
      if (!text || text.length < 20) continue;
      
      console.log(`\nProcessing #${record.id}: "${text.slice(0, 60)}..."`);
      
      const embedding = await generateEmbedding(apiKey, text);
      embeddingsGenerated++;
      
      // Store embedding
      const embeddingId = await storeEmbedding(db, record.id, embedding);
      
      // Update record with normalized topic
      let topics: string[] = [];
      try { topics = JSON.parse(record.topics); } catch {}
      const normalizedTopic = normalizeTopic(topics[0] || 'general');
      
      await db.prepare(`
        UPDATE pain_records SET embedding_id = ?, normalized_topic = ? WHERE id = ?
      `).bind(embeddingId, normalizedTopic, record.id).run();
      
      // Find or create cluster
      const existingClusterCount = await db.prepare(
        "SELECT COUNT(*) as cnt FROM pain_clusters"
      ).first() as { cnt: number };
      
      const { clusterId, similarity } = await getOrCreateSemanticCluster(
        db, apiKey, record, embedding
      );
      
      const newClusterCount = await db.prepare(
        "SELECT COUNT(*) as cnt FROM pain_clusters"
      ).first() as { cnt: number };
      
      if (newClusterCount.cnt > existingClusterCount.cnt) {
        clustersCreated++;
      }
      
      if (clusterId) {
        await addToCluster(db, clusterId, record.id, similarity);
        clustersUpdated.add(clusterId);
        clustered++;
      }
      
    } catch (error) {
      console.error(`  Error processing record ${record.id}:`, error);
    }
  }
  
  // Update stats for all affected clusters
  console.log(`\nUpdating stats for ${clustersUpdated.size} clusters...`);
  for (const clusterId of clustersUpdated) {
    await updateClusterStats(db, clusterId);
  }
  
  console.log(`\n=== Clustering Complete ===`);
  console.log(`Clustered: ${clustered}, Embeddings: ${embeddingsGenerated}`);
  console.log(`Clusters created: ${clustersCreated}, updated: ${clustersUpdated.size}`);
  
  return { 
    clustered, 
    embeddings_generated: embeddingsGenerated,
    clusters_updated: clustersUpdated.size,
    clusters_created: clustersCreated
  };
}

/**
 * Merge similar clusters based on semantic similarity
 * Run periodically to consolidate fragmented clusters
 */
export async function mergeSimularClusters(env: Env): Promise<{
  merged: number;
  clusters_remaining: number;
}> {
  const db = env.DB;
  let merged = 0;
  
  // Get all clusters with their average embeddings
  const clusters = await db.prepare(`
    SELECT pc.id, pc.topic_canonical, pc.broad_category, pc.social_proof_count
    FROM pain_clusters pc
    WHERE pc.social_proof_count > 0
    ORDER BY pc.social_proof_count DESC
  `).all();
  
  const clusterList = clusters.results || [];
  console.log(`\nChecking ${clusterList.length} clusters for merge opportunities...`);
  
  // Calculate average embedding for each cluster
  const clusterEmbeddings = new Map<number, number[]>();
  const allEmbeddings = await getAllEmbeddings(db);
  
  for (const cluster of clusterList) {
    const members = await db.prepare(`
      SELECT pain_record_id FROM cluster_members WHERE cluster_id = ?
    `).bind((cluster as any).id).all();
    
    const memberIds = (members.results || []).map((m: any) => m.pain_record_id);
    const memberEmbeddings = memberIds
      .map(id => allEmbeddings.get(id))
      .filter((e): e is number[] => e !== undefined);
    
    if (memberEmbeddings.length > 0) {
      // Calculate centroid (average of all member embeddings)
      const centroid = new Array(1536).fill(0);
      for (const emb of memberEmbeddings) {
        for (let i = 0; i < emb.length; i++) {
          centroid[i] += emb[i] / memberEmbeddings.length;
        }
      }
      clusterEmbeddings.set((cluster as any).id, centroid);
    }
  }
  
  // Find merge candidates
  const mergeTargets = new Map<number, number>(); // from -> to
  const processed = new Set<number>();
  
  for (const cluster of clusterList) {
    const clusterId = (cluster as any).id;
    if (processed.has(clusterId)) continue;
    
    const embedding = clusterEmbeddings.get(clusterId);
    if (!embedding) continue;
    
    for (const other of clusterList) {
      const otherId = (other as any).id;
      if (otherId === clusterId || processed.has(otherId)) continue;
      
      const otherEmbedding = clusterEmbeddings.get(otherId);
      if (!otherEmbedding) continue;
      
      const similarity = cosineSimilarity(embedding, otherEmbedding);
      
      // v8: Merge if very similar (higher threshold for quality)
      if (similarity > 0.70) {  // v8: Higher merge threshold
        const sameCategory = (cluster as any).broad_category === (other as any).broad_category;
        const topicsMatch_ = topicsMatch(
          (cluster as any).topic_canonical || '',
          (other as any).topic_canonical || ''
        );
        
        if (sameCategory || topicsMatch_) {
          // Merge smaller into larger
          if ((cluster as any).social_proof_count >= (other as any).social_proof_count) {
            mergeTargets.set(otherId, clusterId);
            processed.add(otherId);
          } else {
            mergeTargets.set(clusterId, otherId);
            processed.add(clusterId);
          }
          console.log(`  Will merge cluster ${otherId} → ${clusterId} (similarity: ${similarity.toFixed(3)})`);
        }
      }
    }
    processed.add(clusterId);
  }
  
  // Execute merges
  for (const [fromId, toId] of mergeTargets) {
    // Move all members to target cluster
    await db.prepare(`
      UPDATE cluster_members SET cluster_id = ? WHERE cluster_id = ?
    `).bind(toId, fromId).run();
    
    await db.prepare(`
      UPDATE pain_records SET cluster_id = ? WHERE cluster_id = ?
    `).bind(toId, fromId).run();
    
    // Delete the source cluster
    await db.prepare(`
      DELETE FROM pain_clusters WHERE id = ?
    `).bind(fromId).run();
    
    // Update target cluster stats
    await updateClusterStats(db, toId);
    merged++;
  }
  
  const remaining = await db.prepare(
    "SELECT COUNT(*) as cnt FROM pain_clusters"
  ).first() as { cnt: number };
  
  console.log(`Merged ${merged} clusters. ${remaining.cnt} clusters remaining.`);
  
  return { merged, clusters_remaining: remaining.cnt };
}

/**
 * Get clusters that need synthesis (5+ members, not recently synthesized)
 * v8: More aggressive auto-iteration - trigger on 1-2 new mentions for smaller clusters
 */
export async function getClustersNeedingSynthesis(db: D1Database, limit: number = 10): Promise<PainCluster[]> {
  // v8: Smaller clusters (5-10) re-synth on +1-2 mentions
  // Larger clusters (10+) re-synth on +10% growth
  const result = await db.prepare(`
    SELECT * FROM pain_clusters 
    WHERE social_proof_count >= 5
    AND (
      synthesized_at IS NULL 
      OR last_synth_count = 0
      OR (
        social_proof_count <= 10 
        AND (social_proof_count - last_synth_count) >= 1
      )
      OR (
        social_proof_count > 10 
        AND (social_proof_count - last_synth_count) >= 2
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
    ORDER BY cm.similarity_score DESC, pr.source_score DESC
  `).bind(clusterId).all() as D1Result<PainRecord>;
  return result.results || [];
}
