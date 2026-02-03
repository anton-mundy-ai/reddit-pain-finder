// Layer 5: Scoring v6.1
// Score based on social proof + severity + engagement
// Only scores clusters with 5+ members

import { Env, PainCluster } from '../types';

const BATCH_SIZE = 20;

/**
 * v6.1: Scoring formula with severity weighting
 */
function calculateScore(cluster: PainCluster): number {
  const socialProof = cluster.social_proof_count || 0;
  const uniqueAuthors = cluster.unique_authors || 0;
  const subredditCount = cluster.subreddit_count || 0;
  const totalUpvotes = cluster.total_upvotes || 0;
  
  // Parse severity breakdown from categories
  let severityScore = 0;
  try {
    const categories = JSON.parse(cluster.categories || '{}');
    const severity = categories.severity || {};
    // Weight: critical=4, high=3, medium=2, low=1
    severityScore = (severity.critical || 0) * 4 +
                   (severity.high || 0) * 3 +
                   (severity.medium || 0) * 2 +
                   (severity.low || 0) * 1;
    // Normalize to 0-25
    severityScore = Math.min(25, severityScore * 2);
  } catch {}
  
  // Base score from social proof (0-40 points)
  // 5 = 15, 10 = 25, 20 = 32, 50 = 40
  let socialScore = Math.min(40, Math.log2(socialProof + 1) * 10);
  
  // Author diversity bonus (0-15 points)
  let authorScore = Math.min(15, (uniqueAuthors / Math.max(1, socialProof)) * 20);
  
  // Subreddit diversity bonus (0-10 points)
  let subredditScore = Math.min(10, subredditCount * 2);
  
  // Engagement bonus (0-10 points)
  const avgUpvotes = socialProof > 0 ? totalUpvotes / socialProof : 0;
  let engagementScore = Math.min(10, Math.log2(avgUpvotes + 1) * 2);
  
  return Math.round(socialScore + authorScore + subredditScore + engagementScore + severityScore);
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
  
  // v6.1: Only score clusters with 5+ members that have been synthesized
  const clusters = await db.prepare(`
    SELECT id, product_name, social_proof_count FROM pain_clusters
    WHERE social_proof_count >= 5
      AND synthesized_at IS NOT NULL 
      AND (scored_at IS NULL OR updated_at > scored_at)
    ORDER BY social_proof_count DESC 
    LIMIT ?
  `).bind(BATCH_SIZE).all();
  
  console.log(`Scoring ${clusters.results?.length || 0} clusters (5+ members)...`);
  
  for (const cluster of clusters.results || []) {
    const c = cluster as any;
    const score = await scoreCluster(db, c.id);
    console.log(`  ${c.product_name || `Topic: ${c.topic}`}: Score ${score} (${c.social_proof_count} mentions)`);
    scored++;
  }
  
  console.log(`\n=== Scoring Complete ===`);
  console.log(`Scored: ${scored} clusters`);
  
  return { scored };
}

export async function getTopOpportunities(
  db: D1Database, 
  limit: number = 20,
  minMentions: number = 5  // v6.1: Filter by minimum mentions
): Promise<any[]> {
  const result = await db.prepare(`
    SELECT * FROM pain_clusters
    WHERE product_name IS NOT NULL
    AND social_proof_count >= ?
    ORDER BY total_score DESC, social_proof_count DESC
    LIMIT ?
  `).bind(minMentions, limit).all();
  return result.results || [];
}
