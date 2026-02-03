// Layer 6: Back-Validation v6
// Search Reddit + HackerNews for more evidence
// Triggers re-synthesis when cluster grows 10%+

import { Env, PainCluster, PainRecord } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { fetchHackerNewsComments } from './ingestion';
import { getClusterMembers, updateClusterStats } from './clustering';

const BATCH_SIZE = 5;  // Clusters to back-validate per run
const BACKVALIDATION_COOLDOWN = 24 * 60 * 60;  // 24 hours between validations

/**
 * Search Reddit for keyword matches
 */
async function searchReddit(query: string, limit: number = 50): Promise<any[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&type=comment&sort=relevance&limit=${limit}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PainPointFinder/6.0)' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const comments: any[] = [];
    
    for (const child of data.data?.children || []) {
      const comment = child.data;
      if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') continue;
      if (comment.body.length < 40) continue;
      
      comments.push({
        id: comment.id,
        body: comment.body,
        author: comment.author,
        subreddit: comment.subreddit,
        score: comment.score,
        created_utc: comment.created_utc,
        link_id: comment.link_id?.replace('t3_', '') || '',
        permalink: `https://reddit.com${comment.permalink}`
      });
    }
    
    return comments;
  } catch (error) {
    console.error('Reddit search error:', error);
    return [];
  }
}

/**
 * Check if a comment matches a cluster's problem space
 */
async function isPainMatch(
  apiKey: string,
  commentBody: string,
  clusterDescription: string,
  clusterKeywords: string[]
): Promise<boolean> {
  const prompt = `Does this comment express the SAME PROBLEM as the cluster?

CLUSTER PROBLEM:
${clusterDescription}
Keywords: ${clusterKeywords.join(', ')}

COMMENT:
"${commentBody.slice(0, 500)}"

Answer ONLY: {"match": true} or {"match": false}`;

  try {
    const { content } = await callGPT5Nano(apiKey,
      [{ role: 'user', content: prompt }],
      { max_completion_tokens: 20, json_mode: true }
    );
    return JSON.parse(content).match === true;
  } catch {
    return false;
  }
}

/**
 * Store a back-validated pain record
 */
async function storeBackvalidatedRecord(
  db: D1Database,
  clusterId: number,
  record: {
    source_type: 'comment' | 'hn_comment';
    source_id: string;
    subreddit: string;
    raw_quote: string;
    author: string;
    source_score: number;
    source_url: string;
  }
): Promise<boolean> {
  try {
    // Insert the record
    await db.prepare(`
      INSERT OR IGNORE INTO pain_records
      (source_type, source_id, subreddit, raw_quote, author, source_score, source_url, extracted_at, cluster_id, cluster_similarity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.source_type,
      record.source_id,
      record.subreddit,
      record.raw_quote.slice(0, 1000),
      record.author,
      record.source_score,
      record.source_url,
      Math.floor(Date.now() / 1000),
      clusterId,
      0.8  // Back-validated records get 0.8 similarity
    ).run();
    
    // Check if it was actually inserted
    const inserted = await db.prepare(
      "SELECT id FROM pain_records WHERE source_type = ? AND source_id = ?"
    ).bind(record.source_type, record.source_id).first() as { id: number } | null;
    
    if (inserted) {
      // Add to cluster_members
      await db.prepare(`
        INSERT OR IGNORE INTO cluster_members (cluster_id, pain_record_id, similarity_score, added_at)
        VALUES (?, ?, ?, ?)
      `).bind(clusterId, inserted.id, 0.8, Math.floor(Date.now() / 1000)).run();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to store backvalidated record:', error);
    return false;
  }
}

/**
 * Back-validate a single cluster
 */
async function backvalidateCluster(
  env: Env,
  cluster: PainCluster
): Promise<{ found: number; added: number }> {
  if (!cluster.id) return { found: 0, added: 0 };
  
  const db = env.DB;
  let found = 0;
  let added = 0;
  
  // Get cluster keywords for search
  const keywords = JSON.parse(cluster.search_keywords || '[]').slice(0, 5);
  if (keywords.length === 0) {
    console.log(`    Skipping cluster #${cluster.id}: no keywords`);
    return { found: 0, added: 0 };
  }
  
  // Build search query from top keywords
  const searchQuery = keywords.join(' OR ');
  console.log(`    Searching for: "${searchQuery}"`);
  
  // Search Reddit
  const redditComments = await searchReddit(searchQuery, 30);
  found += redditComments.length;
  
  // Search HackerNews
  const hnComments = await fetchHackerNewsComments(keywords.slice(0, 3).join(' '), 30);
  found += hnComments.length;
  
  // Get existing member IDs to avoid duplicates
  const existingMembers = await getClusterMembers(db, cluster.id);
  const existingIds = new Set(existingMembers.map(m => m.source_id));
  
  // Validate and add Reddit comments
  for (const comment of redditComments) {
    if (existingIds.has(comment.id)) continue;
    if (existingIds.has(`bv_${comment.id}`)) continue;
    
    const isMatch = await isPainMatch(
      env.OPENAI_API_KEY,
      comment.body,
      cluster.centroid_text || '',
      keywords
    );
    
    if (isMatch) {
      const success = await storeBackvalidatedRecord(db, cluster.id, {
        source_type: 'comment',
        source_id: `bv_${comment.id}`,  // Prefix to avoid collision
        subreddit: comment.subreddit,
        raw_quote: comment.body,
        author: comment.author,
        source_score: comment.score || 0,
        source_url: comment.permalink
      });
      
      if (success) added++;
    }
  }
  
  // Validate and add HN comments
  for (const comment of hnComments) {
    const hnId = `bv_hn_${comment.id}`;
    if (existingIds.has(hnId)) continue;
    
    const isMatch = await isPainMatch(
      env.OPENAI_API_KEY,
      comment.text,
      cluster.centroid_text || '',
      keywords
    );
    
    if (isMatch) {
      const success = await storeBackvalidatedRecord(db, cluster.id, {
        source_type: 'hn_comment',
        source_id: hnId,
        subreddit: 'hackernews',
        raw_quote: comment.text,
        author: comment.author,
        source_score: 0,
        source_url: `https://news.ycombinator.com/item?id=${comment.id}`
      });
      
      if (success) added++;
    }
  }
  
  // Update cluster stats if we added anything
  if (added > 0) {
    await updateClusterStats(db, cluster.id);
  }
  
  // Mark as back-validated
  await db.prepare(`
    UPDATE pain_clusters SET last_backvalidation = ? WHERE id = ?
  `).bind(Math.floor(Date.now() / 1000), cluster.id).run();
  
  return { found, added };
}

/**
 * Run back-validation on clusters that need it
 */
export async function runBackvalidation(env: Env): Promise<{
  clusters_validated: number;
  total_found: number;
  total_added: number;
}> {
  const db = env.DB;
  let clustersValidated = 0;
  let totalFound = 0;
  let totalAdded = 0;
  
  const now = Math.floor(Date.now() / 1000);
  const cooldownTime = now - BACKVALIDATION_COOLDOWN;
  
  // Get clusters that need back-validation
  // Priority: high social proof, not recently validated
  const clusters = await db.prepare(`
    SELECT * FROM pain_clusters
    WHERE search_keywords IS NOT NULL
    AND social_proof_count >= 3
    AND (last_backvalidation IS NULL OR last_backvalidation < ?)
    ORDER BY social_proof_count DESC
    LIMIT ?
  `).bind(cooldownTime, BATCH_SIZE).all() as D1Result<PainCluster>;
  
  const toValidate = clusters.results || [];
  
  console.log(`Back-validating ${toValidate.length} clusters...`);
  
  for (const cluster of toValidate) {
    console.log(`  Cluster #${cluster.id} (${cluster.product_name || 'unnamed'}): ${cluster.social_proof_count} mentions`);
    
    const result = await backvalidateCluster(env, cluster);
    
    console.log(`    Found ${result.found}, Added ${result.added}`);
    
    totalFound += result.found;
    totalAdded += result.added;
    clustersValidated++;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n=== Back-Validation Complete ===`);
  console.log(`Clusters: ${clustersValidated}, Found: ${totalFound}, Added: ${totalAdded}`);
  
  return { clusters_validated: clustersValidated, total_found: totalFound, total_added: totalAdded };
}
