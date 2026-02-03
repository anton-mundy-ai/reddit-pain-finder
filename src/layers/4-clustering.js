/**
 * Layer 4: Clustering v3
 * Group similar pain points into opportunity clusters
 * Uses GPT-5-nano for similarity checks
 */

import { checkSimilarity } from '../utils/llm.js';

const BATCH_SIZE = 5;
const SIMILARITY_THRESHOLD = 60;

export async function runClustering(env) {
  const stats = { clustered: 0, newClusters: 0, existingClusters: 0 };
  
  // Get unclustered pain records
  const unclustered = await env.DB.prepare(`
    SELECT id, problem_text, persona, subreddit, source_author
    FROM pain_records
    WHERE cluster_id IS NULL
    ORDER BY extracted_at DESC
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`[Clustering] Found ${unclustered.results.length} unclustered records`);
  
  // Get existing cluster centroids
  const clusters = await env.DB.prepare(`
    SELECT id, centroid_text, product_name, member_count
    FROM pain_clusters
    ORDER BY member_count DESC
    LIMIT 50
  `).all();
  
  for (const record of unclustered.results) {
    let bestMatch = null;
    let bestScore = 0;
    
    // Compare with existing clusters
    for (const cluster of clusters.results) {
      if (!cluster.centroid_text) continue;
      
      try {
        const similarity = await checkSimilarity(env, record.problem_text, cluster.centroid_text);
        
        if (similarity > SIMILARITY_THRESHOLD && similarity > bestScore) {
          bestScore = similarity;
          bestMatch = cluster;
        }
      } catch (e) {
        console.log(`[Clustering] Similarity check failed:`, e.message);
      }
    }
    
    if (bestMatch) {
      // Add to existing cluster
      await env.DB.prepare(`
        UPDATE pain_records SET cluster_id = ? WHERE id = ?
      `).bind(bestMatch.id, record.id).run();
      
      await env.DB.prepare(`
        INSERT INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
        VALUES (?, ?, ?, unixepoch())
      `).bind(bestMatch.id, record.id, bestScore).run();
      
      // Update cluster stats
      await updateClusterStats(env, bestMatch.id);
      
      stats.clustered++;
      stats.existingClusters++;
      console.log(`[Clustering] Added record ${record.id} to cluster ${bestMatch.id} (score: ${bestScore})`);
    } else {
      // Create new cluster
      const result = await env.DB.prepare(`
        INSERT INTO pain_clusters (centroid_text, member_count, created_at, updated_at)
        VALUES (?, 1, unixepoch(), unixepoch())
        RETURNING id
      `).bind(record.problem_text).first();
      
      if (result?.id) {
        await env.DB.prepare(`
          UPDATE pain_records SET cluster_id = ? WHERE id = ?
        `).bind(result.id, record.id).run();
        
        await env.DB.prepare(`
          INSERT INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
          VALUES (?, ?, 100, unixepoch())
        `).bind(result.id, record.id).run();
        
        stats.clustered++;
        stats.newClusters++;
        console.log(`[Clustering] Created new cluster ${result.id} for record ${record.id}`);
        
        // Add to local list for further comparisons
        clusters.results.push({
          id: result.id,
          centroid_text: record.problem_text,
          member_count: 1,
        });
      }
    }
  }
  
  console.log(`[Clustering] Clustered: ${stats.clustered}, New: ${stats.newClusters}, Existing: ${stats.existingClusters}`);
  return stats;
}

async function updateClusterStats(env, clusterId) {
  // Get member stats
  const memberStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as member_count,
      COUNT(DISTINCT source_author) as unique_authors,
      COUNT(DISTINCT subreddit) as subreddit_count,
      AVG(severity_score) as avg_severity,
      AVG(w2p_score) as avg_w2p
    FROM pain_records
    WHERE cluster_id = ?
  `).bind(clusterId).first();
  
  await env.DB.prepare(`
    UPDATE pain_clusters SET
      member_count = ?,
      unique_authors = ?,
      subreddit_count = ?,
      avg_severity = ?,
      avg_w2p = ?,
      updated_at = unixepoch()
    WHERE id = ?
  `).bind(
    memberStats?.member_count || 0,
    memberStats?.unique_authors || 0,
    memberStats?.subreddit_count || 0,
    memberStats?.avg_severity,
    memberStats?.avg_w2p,
    clusterId
  ).run();
}

/**
 * Merge similar clusters (cleanup task)
 */
export async function mergeSimilarClusters(env) {
  const stats = { merged: 0 };
  
  const smallClusters = await env.DB.prepare(`
    SELECT id, centroid_text FROM pain_clusters
    WHERE member_count = 1
    ORDER BY created_at DESC
    LIMIT 10
  `).all();
  
  const largeClusters = await env.DB.prepare(`
    SELECT id, centroid_text, member_count FROM pain_clusters
    WHERE member_count >= 2
    ORDER BY member_count DESC
    LIMIT 20
  `).all();
  
  for (const small of smallClusters.results) {
    for (const large of largeClusters.results) {
      try {
        const similarity = await checkSimilarity(env, small.centroid_text, large.centroid_text);
        
        if (similarity >= 70) {
          // Merge small into large
          await env.DB.prepare(`
            UPDATE pain_records SET cluster_id = ? WHERE cluster_id = ?
          `).bind(large.id, small.id).run();
          
          await env.DB.prepare(`
            UPDATE cluster_members SET cluster_id = ? WHERE cluster_id = ?
          `).bind(large.id, small.id).run();
          
          await env.DB.prepare(`
            DELETE FROM pain_clusters WHERE id = ?
          `).bind(small.id).run();
          
          await updateClusterStats(env, large.id);
          stats.merged++;
          console.log(`[Clustering] Merged cluster ${small.id} into ${large.id}`);
          break;
        }
      } catch (e) {
        // Ignore similarity failures
      }
    }
  }
  
  return stats;
}
