// v10: Trend Detection Layer
// Identify rising pain points and emerging opportunities

import { Env } from '../types';

export interface TrendSnapshot {
  topic_canonical: string;
  cluster_id: number | null;
  snapshot_date: string;
  mention_count: number;
  new_mentions: number;
  velocity: number | null;
  velocity_7d: number | null;
  velocity_30d: number | null;
  trend_status: TrendStatus;
  is_spike: boolean;
  avg_severity: number | null;
  subreddit_spread: number;
}

export type TrendStatus = 'hot' | 'rising' | 'stable' | 'cooling' | 'cold';

export interface TrendSummary {
  topic_canonical: string;
  cluster_id: number | null;
  current_count: number;
  current_velocity: number;
  trend_status: TrendStatus;
  peak_count: number;
  peak_date: string;
  first_seen: string;
  last_updated: number;
  sparkline: number[];
  // Enriched data
  product_name?: string;
  tagline?: string;
}

export interface TrendHistory {
  topic: string;
  snapshots: Array<{
    date: string;
    count: number;
    velocity: number | null;
    status: TrendStatus;
  }>;
}

/**
 * Calculate velocity: (current - previous) / previous
 * Returns null if previous is 0 to avoid division by zero
 */
function calculateVelocity(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 1.0 : null;
  return (current - previous) / previous;
}

/**
 * Determine trend status based on velocity
 */
function classifyTrend(velocity: number | null, isSpike: boolean): TrendStatus {
  if (isSpike) return 'hot';
  if (velocity === null) return 'stable';
  if (velocity >= 0.5) return 'hot';      // 50%+ growth = hot
  if (velocity >= 0.1) return 'rising';   // 10%+ growth = rising
  if (velocity >= -0.1) return 'stable';  // -10% to +10% = stable
  if (velocity >= -0.3) return 'cooling'; // -10% to -30% = cooling
  return 'cold';                           // -30%+ decline = cold
}

/**
 * Detect if this is a sudden spike (3x normal volume)
 */
function detectSpike(currentCount: number, avgCount: number): boolean {
  if (avgCount === 0) return currentCount >= 5;
  return currentCount >= avgCount * 3;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Run daily trend snapshot - capture current counts for all topics
 */
export async function runTrendSnapshot(env: Env): Promise<{
  topics_captured: number;
  hot_topics: number;
  rising_topics: number;
  cooling_topics: number;
  spikes_detected: number;
}> {
  const db = env.DB;
  const today = getTodayDate();
  
  console.log(`\n=== v10 Trend Snapshot: ${today} ===`);
  
  // Get current topic counts from pain_records
  const topicCounts = await db.prepare(`
    SELECT 
      COALESCE(pr.normalized_topic, json_extract(pr.topics, '$[0]')) as topic_canonical,
      pc.id as cluster_id,
      COUNT(DISTINCT pr.id) as mention_count,
      AVG(CASE 
        WHEN pr.severity = 'critical' THEN 4
        WHEN pr.severity = 'high' THEN 3
        WHEN pr.severity = 'medium' THEN 2
        WHEN pr.severity = 'low' THEN 1
        ELSE 2 
      END) as avg_severity,
      COUNT(DISTINCT pr.subreddit) as subreddit_spread
    FROM pain_records pr
    LEFT JOIN pain_clusters pc ON pr.cluster_id = pc.id
    WHERE pr.topics IS NOT NULL
    GROUP BY COALESCE(pr.normalized_topic, json_extract(pr.topics, '$[0]'))
    HAVING topic_canonical IS NOT NULL
  `).all();
  
  const topics = topicCounts.results || [];
  console.log(`Found ${topics.length} topics to snapshot`);
  
  // Get previous snapshot for comparison
  const yesterday = getDateDaysAgo(1);
  const previousSnapshots = await db.prepare(`
    SELECT topic_canonical, mention_count
    FROM pain_trends
    WHERE snapshot_date = ? AND bucket_type = 'daily'
  `).bind(yesterday).all();
  
  const prevMap = new Map<string, number>();
  for (const row of previousSnapshots.results || []) {
    const r = row as any;
    prevMap.set(r.topic_canonical, r.mention_count);
  }
  
  // Get 7-day average for spike detection
  const weekAgo = getDateDaysAgo(7);
  const avgSnapshots = await db.prepare(`
    SELECT topic_canonical, AVG(mention_count) as avg_count
    FROM pain_trends
    WHERE snapshot_date >= ? AND bucket_type = 'daily'
    GROUP BY topic_canonical
  `).bind(weekAgo).all();
  
  const avgMap = new Map<string, number>();
  for (const row of avgSnapshots.results || []) {
    const r = row as any;
    avgMap.set(r.topic_canonical, r.avg_count || 0);
  }
  
  let captured = 0;
  let hotCount = 0;
  let risingCount = 0;
  let coolingCount = 0;
  let spikesCount = 0;
  
  for (const row of topics) {
    const topic = row as any;
    const topicName = topic.topic_canonical as string;
    const currentCount = topic.mention_count as number;
    const prevCount = prevMap.get(topicName) || 0;
    const avgCount = avgMap.get(topicName) || 0;
    
    const newMentions = Math.max(0, currentCount - prevCount);
    const velocity = calculateVelocity(currentCount, prevCount);
    const isSpike = detectSpike(newMentions, avgCount / 7); // Compare new mentions to daily average
    const status = classifyTrend(velocity, isSpike);
    
    // Calculate rolling velocities
    const velocity7d = await calculate7DayVelocity(db, topicName, currentCount);
    const velocity30d = await calculate30DayVelocity(db, topicName, currentCount);
    
    try {
      await db.prepare(`
        INSERT OR REPLACE INTO pain_trends (
          topic_canonical, cluster_id, snapshot_date, bucket_type,
          mention_count, new_mentions, velocity, velocity_7d, velocity_30d,
          trend_status, is_spike, avg_severity, subreddit_spread, created_at
        ) VALUES (?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        topicName,
        topic.cluster_id,
        today,
        currentCount,
        newMentions,
        velocity,
        velocity7d,
        velocity30d,
        status,
        isSpike ? 1 : 0,
        topic.avg_severity,
        topic.subreddit_spread,
        Date.now()
      ).run();
      
      captured++;
      if (status === 'hot') hotCount++;
      if (status === 'rising') risingCount++;
      if (status === 'cooling' || status === 'cold') coolingCount++;
      if (isSpike) spikesCount++;
    } catch (error) {
      console.error(`Error capturing trend for ${topicName}:`, error);
    }
  }
  
  // Update trend summary
  await updateTrendSummary(db);
  
  // Update state
  await db.prepare(`
    UPDATE processing_state SET value = ?, updated_at = ? WHERE key = 'last_trend_snapshot'
  `).bind(today, Date.now()).run();
  
  console.log(`Captured ${captured} topics: ${hotCount} hot, ${risingCount} rising, ${coolingCount} cooling, ${spikesCount} spikes`);
  
  return {
    topics_captured: captured,
    hot_topics: hotCount,
    rising_topics: risingCount,
    cooling_topics: coolingCount,
    spikes_detected: spikesCount
  };
}

/**
 * Calculate 7-day rolling velocity
 */
async function calculate7DayVelocity(db: D1Database, topic: string, currentCount: number): Promise<number | null> {
  const weekAgo = getDateDaysAgo(7);
  const result = await db.prepare(`
    SELECT mention_count FROM pain_trends
    WHERE topic_canonical = ? AND snapshot_date = ? AND bucket_type = 'daily'
  `).bind(topic, weekAgo).first();
  
  if (!result) return null;
  return calculateVelocity(currentCount, (result as any).mention_count);
}

/**
 * Calculate 30-day rolling velocity
 */
async function calculate30DayVelocity(db: D1Database, topic: string, currentCount: number): Promise<number | null> {
  const monthAgo = getDateDaysAgo(30);
  const result = await db.prepare(`
    SELECT mention_count FROM pain_trends
    WHERE topic_canonical = ? AND snapshot_date = ? AND bucket_type = 'daily'
  `).bind(topic, monthAgo).first();
  
  if (!result) return null;
  return calculateVelocity(currentCount, (result as any).mention_count);
}

/**
 * Update trend summary table with current state
 */
async function updateTrendSummary(db: D1Database): Promise<void> {
  const today = getTodayDate();
  
  // Get latest snapshot for each topic
  const latestSnapshots = await db.prepare(`
    SELECT pt.*, pc.product_name, pc.tagline
    FROM pain_trends pt
    LEFT JOIN pain_clusters pc ON pt.cluster_id = pc.id
    WHERE pt.snapshot_date = ? AND pt.bucket_type = 'daily'
  `).bind(today).all();
  
  for (const row of latestSnapshots.results || []) {
    const snapshot = row as any;
    
    // Get sparkline data (last 30 days)
    const sparklineData = await db.prepare(`
      SELECT mention_count FROM pain_trends
      WHERE topic_canonical = ? AND bucket_type = 'daily'
      ORDER BY snapshot_date DESC
      LIMIT 30
    `).bind(snapshot.topic_canonical).all();
    
    const sparkline = (sparklineData.results || [])
      .map((r: any) => r.mention_count)
      .reverse();
    
    // Get peak and first seen
    const stats = await db.prepare(`
      SELECT 
        MAX(mention_count) as peak_count,
        (SELECT snapshot_date FROM pain_trends WHERE topic_canonical = ? AND mention_count = MAX(pt2.mention_count) LIMIT 1) as peak_date,
        MIN(snapshot_date) as first_seen
      FROM pain_trends pt2
      WHERE topic_canonical = ?
    `).bind(snapshot.topic_canonical, snapshot.topic_canonical).first();
    
    await db.prepare(`
      INSERT OR REPLACE INTO trend_summary (
        topic_canonical, cluster_id, current_count, current_velocity,
        trend_status, peak_count, peak_date, first_seen, last_updated, sparkline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshot.topic_canonical,
      snapshot.cluster_id,
      snapshot.mention_count,
      snapshot.velocity_7d || snapshot.velocity || 0,
      snapshot.trend_status,
      (stats as any)?.peak_count || snapshot.mention_count,
      (stats as any)?.peak_date || today,
      (stats as any)?.first_seen || today,
      Date.now(),
      JSON.stringify(sparkline)
    ).run();
  }
}

/**
 * Get trending topics (hot/rising)
 */
export async function getTrends(db: D1Database, options: {
  status?: TrendStatus | 'all';
  limit?: number;
  period?: '7d' | '30d' | '90d';
} = {}): Promise<TrendSummary[]> {
  const { status = 'all', limit = 50, period = '7d' } = options;
  
  let whereClause = '';
  if (status !== 'all') {
    whereClause = `WHERE ts.trend_status = '${status}'`;
  }
  
  const velocityField = period === '7d' ? 'current_velocity' : 
                        period === '30d' ? 'current_velocity' : 'current_velocity';
  
  const results = await db.prepare(`
    SELECT 
      ts.*,
      pc.product_name,
      pc.tagline
    FROM trend_summary ts
    LEFT JOIN pain_clusters pc ON ts.cluster_id = pc.id
    ${whereClause}
    ORDER BY 
      CASE ts.trend_status 
        WHEN 'hot' THEN 1 
        WHEN 'rising' THEN 2 
        WHEN 'stable' THEN 3 
        WHEN 'cooling' THEN 4 
        ELSE 5 
      END,
      ts.${velocityField} DESC
    LIMIT ?
  `).bind(limit).all();
  
  return (results.results || []).map((r: any) => ({
    topic_canonical: r.topic_canonical,
    cluster_id: r.cluster_id,
    current_count: r.current_count,
    current_velocity: r.current_velocity || 0,
    trend_status: r.trend_status as TrendStatus,
    peak_count: r.peak_count,
    peak_date: r.peak_date,
    first_seen: r.first_seen,
    last_updated: r.last_updated,
    sparkline: JSON.parse(r.sparkline || '[]'),
    product_name: r.product_name,
    tagline: r.tagline
  }));
}

/**
 * Get trend history for a specific topic
 */
export async function getTrendHistory(db: D1Database, topic: string, days: number = 90): Promise<TrendHistory> {
  const cutoffDate = getDateDaysAgo(days);
  
  const results = await db.prepare(`
    SELECT snapshot_date, mention_count, velocity, trend_status
    FROM pain_trends
    WHERE topic_canonical = ? AND snapshot_date >= ? AND bucket_type = 'daily'
    ORDER BY snapshot_date ASC
  `).bind(topic, cutoffDate).all();
  
  return {
    topic,
    snapshots: (results.results || []).map((r: any) => ({
      date: r.snapshot_date,
      count: r.mention_count,
      velocity: r.velocity,
      status: r.trend_status as TrendStatus
    }))
  };
}

/**
 * Get hot topics (velocity > 50% or spikes)
 */
export async function getHotTopics(db: D1Database, limit: number = 20): Promise<TrendSummary[]> {
  return getTrends(db, { status: 'hot', limit });
}

/**
 * Get cooling topics (negative velocity)
 */
export async function getCoolingTopics(db: D1Database, limit: number = 20): Promise<TrendSummary[]> {
  const results = await db.prepare(`
    SELECT 
      ts.*,
      pc.product_name,
      pc.tagline
    FROM trend_summary ts
    LEFT JOIN pain_clusters pc ON ts.cluster_id = pc.id
    WHERE ts.trend_status IN ('cooling', 'cold')
    ORDER BY ts.current_velocity ASC
    LIMIT ?
  `).bind(limit).all();
  
  return (results.results || []).map((r: any) => ({
    topic_canonical: r.topic_canonical,
    cluster_id: r.cluster_id,
    current_count: r.current_count,
    current_velocity: r.current_velocity || 0,
    trend_status: r.trend_status as TrendStatus,
    peak_count: r.peak_count,
    peak_date: r.peak_date,
    first_seen: r.first_seen,
    last_updated: r.last_updated,
    sparkline: JSON.parse(r.sparkline || '[]'),
    product_name: r.product_name,
    tagline: r.tagline
  }));
}

/**
 * Get trend stats for dashboard
 */
export async function getTrendStats(db: D1Database): Promise<{
  total_tracked: number;
  hot_count: number;
  rising_count: number;
  stable_count: number;
  cooling_count: number;
  last_snapshot: string | null;
}> {
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN trend_status = 'hot' THEN 1 ELSE 0 END) as hot,
      SUM(CASE WHEN trend_status = 'rising' THEN 1 ELSE 0 END) as rising,
      SUM(CASE WHEN trend_status = 'stable' THEN 1 ELSE 0 END) as stable,
      SUM(CASE WHEN trend_status IN ('cooling', 'cold') THEN 1 ELSE 0 END) as cooling
    FROM trend_summary
  `).first();
  
  const lastSnapshot = await db.prepare(`
    SELECT value FROM processing_state WHERE key = 'last_trend_snapshot'
  `).first();
  
  return {
    total_tracked: (stats as any)?.total || 0,
    hot_count: (stats as any)?.hot || 0,
    rising_count: (stats as any)?.rising || 0,
    stable_count: (stats as any)?.stable || 0,
    cooling_count: (stats as any)?.cooling || 0,
    last_snapshot: (lastSnapshot as any)?.value || null
  };
}
