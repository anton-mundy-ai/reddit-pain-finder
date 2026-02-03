/**
 * Layer 4: Clustering
 * Group similar pain points using LLM-based similarity
 */

const SIMILARITY_THRESHOLD = 0.70;
const BATCH_SIZE = 5;

export async function runClustering(env) {
  const stats = { clustered: 0, newClusters: 0 };
  
  // Get unclustered pain records
  const unclustered = await env.DB.prepare(`
    SELECT id, problem_text, persona, subreddit
    FROM pain_records
    WHERE cluster_id IS NULL AND problem_text IS NOT NULL AND problem_text != ''
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`Found ${unclustered.results.length} unclustered records`);
  
  for (const record of unclustered.results) {
    try {
      // Generate embedding for the problem statement
      const embedding = await getEmbedding(env, record.problem_text);
      
      if (!embedding) {
        console.error('Failed to generate embedding for record:', record.id);
        continue;
      }
      
      // Find best matching cluster by comparing with existing cluster centroids
      let bestClusterId = null;
      let bestScore = 0;
      
      // Get existing clusters with their representative pain records
      const existingClusters = await env.DB.prepare(`
        SELECT c.id as cluster_id, c.centroid_text
        FROM pain_clusters c
        WHERE c.centroid_text IS NOT NULL
        LIMIT 50
      `).all();
      
      for (const cluster of existingClusters.results) {
        if (!cluster.centroid_text) continue;
        const clusterEmbedding = await getEmbedding(env, cluster.centroid_text);
        if (clusterEmbedding) {
          const similarity = cosineSimilarity(embedding, clusterEmbedding);
          if (similarity >= SIMILARITY_THRESHOLD && similarity > bestScore) {
            bestScore = similarity;
            bestClusterId = cluster.cluster_id;
          }
        }
      }
      
      let clusterId;
      const now = Math.floor(Date.now() / 1000);
      
      if (bestClusterId) {
        clusterId = bestClusterId;
        console.log(`Record ${record.id} matched existing cluster ${clusterId}`);
      } else {
        // Create new cluster with centroid_text from first record
        const result = await env.DB.prepare(`
          INSERT INTO pain_clusters (centroid_text, member_count, created_at, updated_at)
          VALUES (?, 1, ?, ?)
        `).bind(record.problem_text, now, now).run();
        
        clusterId = result.meta.last_row_id;
        stats.newClusters++;
        console.log(`Created new cluster ${clusterId} for record ${record.id}`);
      }
      
      // Update pain record with cluster
      await env.DB.prepare(`
        UPDATE pain_records SET cluster_id = ? WHERE id = ?
      `).bind(clusterId, record.id).run();
      
      // Add to cluster_members
      await env.DB.prepare(`
        INSERT OR IGNORE INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
        VALUES (?, ?, ?, ?)
      `).bind(clusterId, record.id, bestScore || 1.0, now).run();
      
      // Update cluster stats
      const memberStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as member_count,
          COUNT(DISTINCT pr.source_author) as unique_authors,
          COUNT(DISTINCT pr.subreddit) as subreddit_count,
          AVG(pr.severity_score) as avg_severity
        FROM cluster_members cm
        JOIN pain_records pr ON pr.id = cm.pain_record_id
        WHERE cm.cluster_id = ?
      `).bind(clusterId).first();
      
      await env.DB.prepare(`
        UPDATE pain_clusters 
        SET member_count = ?, unique_authors = ?, subreddit_count = ?, 
            avg_severity = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        memberStats?.member_count || 1,
        memberStats?.unique_authors || 1,
        memberStats?.subreddit_count || 1,
        memberStats?.avg_severity || 0,
        now,
        clusterId
      ).run();
      
      stats.clustered++;
    } catch (error) {
      console.error('Clustering error for record', record.id, ':', error.message);
    }
  }
  
  console.log('Clustering stats:', stats);
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
