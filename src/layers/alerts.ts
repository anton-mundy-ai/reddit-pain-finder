// v14: Real-time Alerts Layer
// Generates alerts when hot opportunities emerge or trends spike

import { D1Database } from '@cloudflare/workers-types';

export type AlertType = 
  | 'new_cluster'        // New qualifying cluster (5+ mentions)
  | 'trend_spike'        // Trend spike (3x normal volume)
  | 'competitor_gap'     // New competitor feature gap discovered
  | 'high_severity';     // High-severity pain point cluster

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: number;
  alert_type: AlertType;
  title: string;
  description: string;
  severity: AlertSeverity;
  opportunity_id: number | null;
  topic_canonical: string | null;
  product_name: string | null;
  created_at: number;
  read_at: number | null;
}

export interface CreateAlertInput {
  alert_type: AlertType;
  title: string;
  description: string;
  severity: AlertSeverity;
  opportunity_id?: number;
  topic_canonical?: string;
  product_name?: string;
}

// ===============================
// Alert CRUD Operations
// ===============================

/**
 * Create a new alert
 */
export async function createAlert(db: D1Database, input: CreateAlertInput): Promise<number> {
  const now = Date.now();
  
  const result = await db.prepare(`
    INSERT INTO alerts (alert_type, title, description, severity, opportunity_id, topic_canonical, product_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.alert_type,
    input.title,
    input.description,
    input.severity,
    input.opportunity_id || null,
    input.topic_canonical || null,
    input.product_name || null,
    now
  ).run();
  
  return result.meta.last_row_id || 0;
}

/**
 * Get alerts with filtering
 */
export async function getAlerts(
  db: D1Database,
  options: {
    type?: AlertType;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Alert[]> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  
  let query = 'SELECT * FROM alerts WHERE 1=1';
  const params: any[] = [];
  
  if (options.type) {
    query += ' AND alert_type = ?';
    params.push(options.type);
  }
  
  if (options.unreadOnly) {
    query += ' AND read_at IS NULL';
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const result = await db.prepare(query).bind(...params).all();
  return (result.results || []) as Alert[];
}

/**
 * Get unread alert count
 */
export async function getUnreadCount(db: D1Database): Promise<number> {
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM alerts WHERE read_at IS NULL
  `).first();
  return (result as any)?.count || 0;
}

/**
 * Mark single alert as read
 */
export async function markAlertRead(db: D1Database, alertId: number): Promise<boolean> {
  const now = Date.now();
  const result = await db.prepare(`
    UPDATE alerts SET read_at = ? WHERE id = ? AND read_at IS NULL
  `).bind(now, alertId).run();
  return (result.meta.changes || 0) > 0;
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsRead(db: D1Database): Promise<number> {
  const now = Date.now();
  const result = await db.prepare(`
    UPDATE alerts SET read_at = ? WHERE read_at IS NULL
  `).bind(now).run();
  return result.meta.changes || 0;
}

/**
 * Delete old alerts (keep last 30 days)
 */
export async function cleanupOldAlerts(db: D1Database): Promise<number> {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const result = await db.prepare(`
    DELETE FROM alerts WHERE created_at < ? AND read_at IS NOT NULL
  `).bind(thirtyDaysAgo).run();
  return result.meta.changes || 0;
}

// ===============================
// Alert Detection Logic
// ===============================

interface AlertCheckResult {
  alerts_created: number;
  new_clusters: number;
  trend_spikes: number;
  competitor_gaps: number;
  high_severity: number;
}

/**
 * Check for new qualifying clusters (5+ mentions) created in last hour
 */
async function checkNewClusters(db: D1Database): Promise<number> {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Find clusters created in last hour with 5+ social proof
  const newClusters = await db.prepare(`
    SELECT id, product_name, tagline, social_proof_count, topic_canonical
    FROM pain_clusters
    WHERE created_at > ? 
      AND social_proof_count >= 5
      AND product_name IS NOT NULL
  `).bind(oneHourAgo).all();
  
  let created = 0;
  for (const cluster of (newClusters.results || [])) {
    const c = cluster as any;
    
    // Check if we already have an alert for this cluster
    const existing = await db.prepare(`
      SELECT id FROM alerts 
      WHERE alert_type = 'new_cluster' AND opportunity_id = ?
    `).bind(c.id).first();
    
    if (!existing) {
      await createAlert(db, {
        alert_type: 'new_cluster',
        title: `New Opportunity: ${c.product_name}`,
        description: `"${c.tagline}" with ${c.social_proof_count} social proof mentions`,
        severity: c.social_proof_count >= 15 ? 'critical' : c.social_proof_count >= 10 ? 'warning' : 'info',
        opportunity_id: c.id,
        topic_canonical: c.topic_canonical,
        product_name: c.product_name
      });
      created++;
    }
  }
  
  return created;
}

/**
 * Check for trend spikes (3x normal volume in last 24 hours)
 */
async function checkTrendSpikes(db: D1Database): Promise<number> {
  // Get topics with significant velocity increase
  const spikes = await db.prepare(`
    SELECT ts.topic_canonical, ts.current_velocity, ts.trend_status, 
           ts.current_count, pc.id as cluster_id, pc.product_name
    FROM trend_summary ts
    LEFT JOIN pain_clusters pc ON ts.cluster_id = pc.id
    WHERE ts.trend_status IN ('hot', 'rising')
      AND ts.current_velocity >= 3.0
      AND ts.last_updated > ?
  `).bind(Date.now() - (24 * 60 * 60 * 1000)).all();
  
  let created = 0;
  for (const spike of (spikes.results || [])) {
    const s = spike as any;
    
    // Check if we already alerted this topic in last 24 hours
    const existing = await db.prepare(`
      SELECT id FROM alerts 
      WHERE alert_type = 'trend_spike' 
        AND topic_canonical = ?
        AND created_at > ?
    `).bind(s.topic_canonical, Date.now() - (24 * 60 * 60 * 1000)).first();
    
    if (!existing) {
      await createAlert(db, {
        alert_type: 'trend_spike',
        title: `🔥 Trend Spike: ${s.topic_canonical}`,
        description: `${s.current_velocity.toFixed(1)}x normal volume (${s.current_count} mentions)`,
        severity: s.current_velocity >= 5 ? 'critical' : 'warning',
        opportunity_id: s.cluster_id,
        topic_canonical: s.topic_canonical,
        product_name: s.product_name
      });
      created++;
    }
  }
  
  return created;
}

/**
 * Check for new competitor feature gaps discovered
 */
async function checkCompetitorGaps(db: D1Database): Promise<number> {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Find feature gaps discovered in last hour with 3+ mentions
  const gaps = await db.prepare(`
    SELECT feature_gap, product_name, COUNT(*) as mention_count,
           GROUP_CONCAT(DISTINCT category) as categories
    FROM competitor_mentions
    WHERE feature_gap IS NOT NULL
      AND created_at > ?
    GROUP BY feature_gap, product_name
    HAVING COUNT(*) >= 3
  `).bind(oneHourAgo).all();
  
  let created = 0;
  for (const gap of (gaps.results || [])) {
    const g = gap as any;
    
    // Check if we already alerted this gap
    const alertKey = `${g.product_name}:${g.feature_gap}`.slice(0, 100);
    const existing = await db.prepare(`
      SELECT id FROM alerts 
      WHERE alert_type = 'competitor_gap' 
        AND description LIKE ?
        AND created_at > ?
    `).bind(`%${g.feature_gap.slice(0, 50)}%`, Date.now() - (7 * 24 * 60 * 60 * 1000)).first();
    
    if (!existing) {
      await createAlert(db, {
        alert_type: 'competitor_gap',
        title: `Feature Gap: ${g.product_name}`,
        description: `"${g.feature_gap}" - ${g.mention_count} users want this`,
        severity: g.mention_count >= 10 ? 'critical' : g.mention_count >= 5 ? 'warning' : 'info',
        product_name: g.product_name
      });
      created++;
    }
  }
  
  return created;
}

/**
 * Check for high-severity pain point clusters
 */
async function checkHighSeverity(db: D1Database): Promise<number> {
  // Find clusters with high proportion of critical/high severity
  const highSeverityClusters = await db.prepare(`
    SELECT pc.id, pc.product_name, pc.tagline, pc.topic_canonical,
           pc.social_proof_count, pc.categories
    FROM pain_clusters pc
    WHERE pc.social_proof_count >= 5
      AND pc.product_name IS NOT NULL
      AND pc.updated_at > ?
  `).bind(Date.now() - (60 * 60 * 1000)).all();
  
  let created = 0;
  for (const cluster of (highSeverityClusters.results || [])) {
    const c = cluster as any;
    
    // Parse categories to get severity breakdown
    let categories: any = {};
    try { categories = JSON.parse(c.categories || '{}'); } catch {}
    
    const severityBreakdown = categories.severity || {};
    const critical = severityBreakdown.critical || 0;
    const high = severityBreakdown.high || 0;
    const total = c.social_proof_count || 1;
    
    // Alert if >50% are critical/high severity
    const highSeverityRatio = (critical + high) / total;
    if (highSeverityRatio >= 0.5 && (critical + high) >= 3) {
      // Check if we already alerted this
      const existing = await db.prepare(`
        SELECT id FROM alerts 
        WHERE alert_type = 'high_severity' 
          AND opportunity_id = ?
          AND created_at > ?
      `).bind(c.id, Date.now() - (24 * 60 * 60 * 1000)).first();
      
      if (!existing) {
        await createAlert(db, {
          alert_type: 'high_severity',
          title: `⚠️ High-Severity Pain: ${c.product_name}`,
          description: `${Math.round(highSeverityRatio * 100)}% report critical/high severity (${critical + high}/${total})`,
          severity: 'critical',
          opportunity_id: c.id,
          topic_canonical: c.topic_canonical,
          product_name: c.product_name
        });
        created++;
      }
    }
  }
  
  return created;
}

/**
 * Run all alert checks - called at end of pipeline
 */
export async function runAlertChecks(db: D1Database): Promise<AlertCheckResult> {
  console.log('\n=== Running Alert Checks ===');
  
  const [newClusters, trendSpikes, competitorGaps, highSeverity] = await Promise.all([
    checkNewClusters(db).catch(e => { console.error('New clusters check failed:', e); return 0; }),
    checkTrendSpikes(db).catch(e => { console.error('Trend spikes check failed:', e); return 0; }),
    checkCompetitorGaps(db).catch(e => { console.error('Competitor gaps check failed:', e); return 0; }),
    checkHighSeverity(db).catch(e => { console.error('High severity check failed:', e); return 0; })
  ]);
  
  const totalCreated = newClusters + trendSpikes + competitorGaps + highSeverity;
  
  // Cleanup old alerts
  const deleted = await cleanupOldAlerts(db);
  
  console.log(`Alerts created: ${totalCreated} (new_cluster: ${newClusters}, trend_spike: ${trendSpikes}, competitor_gap: ${competitorGaps}, high_severity: ${highSeverity})`);
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old alerts`);
  }
  
  return {
    alerts_created: totalCreated,
    new_clusters: newClusters,
    trend_spikes: trendSpikes,
    competitor_gaps: competitorGaps,
    high_severity: highSeverity
  };
}

/**
 * Get alert stats for dashboard
 */
export async function getAlertStats(db: D1Database): Promise<{
  total: number;
  unread: number;
  by_type: Record<AlertType, number>;
  by_severity: Record<AlertSeverity, number>;
  recent_24h: number;
}> {
  const [total, unread, byType, bySeverity, recent] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM alerts').first(),
    db.prepare('SELECT COUNT(*) as count FROM alerts WHERE read_at IS NULL').first(),
    db.prepare(`
      SELECT alert_type, COUNT(*) as count FROM alerts GROUP BY alert_type
    `).all(),
    db.prepare(`
      SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity
    `).all(),
    db.prepare(`
      SELECT COUNT(*) as count FROM alerts WHERE created_at > ?
    `).bind(Date.now() - (24 * 60 * 60 * 1000)).first()
  ]);
  
  const byTypeMap: Record<string, number> = {};
  for (const row of (byType.results || [])) {
    byTypeMap[(row as any).alert_type] = (row as any).count;
  }
  
  const bySeverityMap: Record<string, number> = {};
  for (const row of (bySeverity.results || [])) {
    bySeverityMap[(row as any).severity] = (row as any).count;
  }
  
  return {
    total: (total as any)?.count || 0,
    unread: (unread as any)?.count || 0,
    by_type: byTypeMap as Record<AlertType, number>,
    by_severity: bySeverityMap as Record<AlertSeverity, number>,
    recent_24h: (recent as any)?.count || 0
  };
}
