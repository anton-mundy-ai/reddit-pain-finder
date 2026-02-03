/**
 * Layer 4: Clustering
 * Group similar pain points using LLM-based similarity
 * Uses text embeddings with cosine similarity stored in D1
 */

const SIMILARITY_THRESHOLD = 0.70;
const BATCH_SIZE = 5;

export async function runClustering(env) {
  const stats = { clustered: 0, newClusters: 0 };
  
  // Get unclustered pain records
  const unclustered = await env.DB.prepare(`
    SELECT id, problem_statement, persona, subreddit
    FROM pain_records
    WHERE cluster_id IS NULL AND problem_statement IS NOT NULL AND problem_statement != ''
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  for (const record of unclustered.results) {
    try {
      // Generate embedding for the problem statement
      const embedding = await getEmbedding(env, record.problem_statement);
      
      if (!embedding) {
        console.error('Failed to generate embedding for record:', record.id);
        continue;
      }
      
      // Find best matching cluster by comparing with existing cluster centroids
      let bestClusterId = null;
      let bestScore = 0;
      
      // Get existing clusters with their representative pain records
      const existingClusters = await env.DB.prepare(`
        SELECT c.id as cluster_id, pr.problem_statement
        FROM pain_clusters c
        JOIN cluster_members cm ON cm.cluster_id = c.id
        JOIN pain_records pr ON pr.id = cm.pain_record_id
        WHERE c.is_active = 1
        GROUP BY c.id
        LIMIT 100
      `).all();
      
      for (const cluster of existingClusters.results) {
        const clusterEmbedding = await getEmbedding(env, cluster.problem_statement);
        if (clusterEmbedding) {
          const similarity = cosineSimilarity(embedding, clusterEmbedding);
          if (similarity >= SIMILARITY_THRESHOLD && similarity > bestScore) {
            bestScore = similarity;
            bestClusterId = cluster.cluster_id;
          }
        }
      }
      
      let clusterId;
      
      if (bestClusterId) {
        // Add to existing cluster
        clusterId = bestClusterId;
      } else {
        // Create new cluster
        const result = await env.DB.prepare(`
          INSERT INTO pain_clusters (name, member_count) VALUES (?, 1)
        `).bind(`Cluster-${Date.now()}`).run();
        
        clusterId = result.meta.last_row_id;
        stats.newClusters++;
      }
      
      // Update pain record with cluster
      await env.DB.prepare(`
        UPDATE pain_records SET cluster_id = ? WHERE id = ?
      `).bind(clusterId, record.id).run();
      
      // Add to cluster_members
      await env.DB.prepare(`
        INSERT INTO cluster_members (cluster_id, pain_record_id, similarity_score)
        VALUES (?, ?, ?)
      `).bind(clusterId, record.id, bestScore || 1.0).run();
      
      // Update cluster member count
      const memberCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM cluster_members WHERE cluster_id = ?
      `).bind(clusterId).first();
      
      await env.DB.prepare(`
        UPDATE pain_clusters SET member_count = ?, updated_at = unixepoch() WHERE id = ?
      `).bind(memberCount?.count || 1, clusterId).run();
      
      stats.clustered++;
    } catch (error) {
      console.error('Clustering error for record', record.id, ':', error);
    }
  }
  
  return stats;
}

async function getEmbedding(env, text) {
  const apiKey = env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY not configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Embedding API error:', error);
      return null;
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
