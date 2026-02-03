// Layer 5: Simple Scoring
// v5: Score based primarily on social proof + engagement signals

import { Env, PainCluster } from '../types';

const BATCH_SIZE = 20;

/**
 * v5: Simple scoring formula
 * Social proof is the main signal
 */
function calculateScore(cluster: PainCluster): number {
  const socialProof = cluster.social_proof_count || 0;
  const uniqueAuthors = cluster.unique_authors || 0;
  const subredditCount = cluster.subreddit_count || 0;
  const totalUpvotes = cluster.total_upvotes || 0;
  
  // Base score from social proof (0-50 points)
  // 3 mentions = 10 points, 10 = 20, 30 = 35, 100+ = 50
  let socialScore = Math.min(50, Math.log2(socialProof + 1) * 10);
  
  // Author diversity bonus (0-20 points)
  // More unique authors = more real signal
  let authorScore = Math.min(20, (uniqueAuthors / Math.max(1, socialProof)) * 25);
  
  // Subreddit diversity bonus (0-15 points)
  // Problem spans multiple communities = broader market
  let subredditScore = Math.min(15, subredditCount * 3);
  
  // Engagement bonus (0-15 points)
  // Higher upvotes = community validates the pain
  const avgUpvotes = socialProof > 0 ? totalUpvotes / socialProof : 0;
  let engagementScore = Math.min(15, Math.log2(avgUpvotes + 1) * 3);
  
  return Math.round(socialScore + authorScore + subredditScore + engagementScore);
}

async function scoreCluster(db: D1Database, clusterId: number): Promise<number> {
  const cluster = await db.prepare(`
    SELECT * FROM pain_clusters WHERE id = ?
  `).bind(clusterId).first() as PainCluster | null;
  
  if (!cluster) return 0;
  
  const score = calculateScore(cluster);
  const now = Math.floor(Date.now() / 1000);
  
  await db.prepare(`
    UPDATE pain_clusters SET total_score = ?, scored_at = ? WHERE id = ?
  `).bind(score, now, clusterId).run();
  
  return score;
}

export async function runScoring(env: Env): Promise<{ scored: number }> {
  const db = env.DB;
  let scored = 0;
  
  // Get clusters that need scoring (synthesized but not scored, or updated)
  const clusters = await db.prepare(`
    SELECT id, product_name, social_proof_count FROM pain_clusters
    WHERE synthesized_at IS NOT NULL 
      AND (scored_at IS NULL OR updated_at > scored_at)
    ORDER BY social_proof_count DESC 
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`Scoring ${clusters.results?.length || 0} clusters...`);
  
  for (const cluster of clusters.results || []) {
    const c = cluster as any;
    const score = await scoreCluster(db, c.id);
    console.log(`  ${c.product_name || `Cluster #${c.id}`}: Score ${score} (${c.social_proof_count} mentions)`);
    scored++;
  }
  
  console.log(`\n=== Scoring Complete ===`);
  console.log(`Scored: ${scored} clusters`);
  
  return { scored };
}

export async function getTopOpportunities(
  db: D1Database, 
  limit: number = 20
): Promise<any[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_clusters
    WHERE product_name IS NOT NULL
    ORDER BY total_score DESC, social_proof_count DESC
    LIMIT ?
  `).bind(limit).all();
  return result.results || [];
}
