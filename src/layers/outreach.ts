// Layer 9: Outreach List Builder v15
// Extract potential early adopters from pain records for founder outreach
// Focus on Reddit users who expressed pain points

import { Env } from '../types';

// Outreach status types
export type OutreachStatus = 'pending' | 'contacted' | 'responded' | 'declined';

// Outreach contact from database
export interface OutreachContact {
  id: number;
  username: string;
  opportunity_id: number;
  fit_score: number;
  pain_severity: string | null;
  engagement_score: number;
  recency_score: number;
  source_post_url: string;
  pain_expressed: string;
  subreddit: string | null;
  post_created_at: number | null;
  outreach_status: OutreachStatus;
  contacted_at: number | null;
  responded_at: number | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

// Outreach contact with opportunity context
export interface OutreachContactWithContext extends OutreachContact {
  product_name: string;
  tagline: string;
  topic: string;
}

// Outreach template suggestion
export interface OutreachTemplate {
  type: 'dm' | 'comment' | 'post';
  subject?: string;
  body: string;
  tips: string[];
}

// Scoring weights
const SEVERITY_SCORES: Record<string, number> = {
  'critical': 40,
  'high': 30,
  'medium': 20,
  'low': 10
};

const RECENCY_WINDOWS = [
  { days: 7, score: 30 },    // Last week - hot lead
  { days: 30, score: 25 },   // Last month - warm lead
  { days: 90, score: 15 },   // Last quarter - cool lead
  { days: 365, score: 5 },   // Last year - cold lead
  { days: Infinity, score: 0 }
];

/**
 * Calculate fit score for a potential early adopter
 */
function calculateFitScore(
  severity: string | null,
  upvotes: number,
  postTimestamp: number | null
): { total: number; severity: number; engagement: number; recency: number } {
  // Severity score (0-40 points)
  const severityScore = SEVERITY_SCORES[severity || 'medium'] || 20;
  
  // Engagement score (0-30 points) - log scale for upvotes
  const engagementScore = Math.min(30, Math.round(Math.log2(Math.max(1, upvotes + 1)) * 5));
  
  // Recency score (0-30 points)
  let recencyScore = 0;
  if (postTimestamp) {
    const daysAgo = (Date.now() / 1000 - postTimestamp) / (24 * 60 * 60);
    for (const window of RECENCY_WINDOWS) {
      if (daysAgo <= window.days) {
        recencyScore = window.score;
        break;
      }
    }
  }
  
  return {
    total: severityScore + engagementScore + recencyScore,
    severity: severityScore,
    engagement: engagementScore,
    recency: recencyScore
  };
}

/**
 * Generate outreach templates for a specific opportunity
 */
export function generateOutreachTemplates(
  productName: string,
  tagline: string,
  targetCustomer: string,
  painExpressed: string
): OutreachTemplate[] {
  const templates: OutreachTemplate[] = [];
  
  // Direct Message template
  templates.push({
    type: 'dm',
    subject: `Quick question about ${painExpressed.slice(0, 50).replace(/[^\w\s]/g, '')}...`,
    body: `Hey! I came across your post about ${painExpressed.slice(0, 100)}...

I'm building something that might help: ${productName} - ${tagline}

Would you be open to a quick 10-minute chat? I'd love to learn more about your experience and see if we could help.

No pressure either way - just trying to validate if this is a real problem worth solving.`,
    tips: [
      'Personalize the opening based on their specific quote',
      'Keep it short and casual',
      "Don't sell - ask questions",
      'Offer value first (e.g., share what you learned)'
    ]
  });
  
  // Reddit comment template
  templates.push({
    type: 'comment',
    body: `This is exactly the problem I've been researching! 

I'm working on ${productName} to help with this. Would love to hear more about your experience - what have you tried so far?`,
    tips: [
      'Only comment on recent posts (< 7 days)',
      'Add value to the conversation first',
      "Don't be overtly promotional",
      'Ask follow-up questions'
    ]
  });
  
  return templates;
}

/**
 * Build outreach list for a specific opportunity
 */
export async function buildOutreachList(
  db: D1Database,
  opportunityId: number
): Promise<{ added: number; updated: number; total: number }> {
  const now = Date.now();
  
  // Get all pain records for this cluster with author info
  const members = await db.prepare(`
    SELECT DISTINCT
      pr.author,
      pr.raw_quote,
      pr.severity,
      pr.source_score,
      pr.source_url,
      pr.source_created_utc,
      pr.subreddit
    FROM pain_records pr
    JOIN cluster_members cm ON pr.id = cm.pain_record_id
    WHERE cm.cluster_id = ?
      AND pr.author IS NOT NULL
      AND pr.author != '[deleted]'
      AND pr.author != 'AutoModerator'
      AND pr.source_url IS NOT NULL
  `).bind(opportunityId).all();
  
  const records = members.results || [];
  
  let added = 0;
  let updated = 0;
  
  // Group by username to avoid duplicates, keep best quote
  const userMap = new Map<string, {
    username: string;
    bestQuote: string;
    bestUrl: string;
    severity: string | null;
    maxScore: number;
    subreddit: string | null;
    postCreatedAt: number | null;
    fitScore: { total: number; severity: number; engagement: number; recency: number };
  }>();
  
  for (const row of records) {
    const r = row as any;
    const username = r.author as string;
    
    // Calculate fit score
    const fitScore = calculateFitScore(
      r.severity,
      r.source_score || 0,
      r.source_created_utc
    );
    
    const existing = userMap.get(username);
    
    // Keep record with highest fit score
    if (!existing || fitScore.total > existing.fitScore.total) {
      userMap.set(username, {
        username,
        bestQuote: r.raw_quote || '',
        bestUrl: r.source_url || '',
        severity: r.severity,
        maxScore: r.source_score || 0,
        subreddit: r.subreddit,
        postCreatedAt: r.source_created_utc,
        fitScore
      });
    }
  }
  
  // Insert or update contacts
  for (const [username, data] of userMap) {
    try {
      // Check if contact already exists
      const existing = await db.prepare(`
        SELECT id, outreach_status FROM outreach_contacts 
        WHERE username = ? AND opportunity_id = ?
      `).bind(username, opportunityId).first();
      
      if (existing) {
        // Update if status is still pending (don't overwrite contacted/responded)
        if ((existing as any).outreach_status === 'pending') {
          await db.prepare(`
            UPDATE outreach_contacts SET
              fit_score = ?,
              pain_severity = ?,
              engagement_score = ?,
              recency_score = ?,
              source_post_url = ?,
              pain_expressed = ?,
              subreddit = ?,
              post_created_at = ?,
              updated_at = ?
            WHERE id = ?
          `).bind(
            data.fitScore.total,
            data.severity,
            data.fitScore.engagement,
            data.fitScore.recency,
            data.bestUrl,
            data.bestQuote.slice(0, 1000),
            data.subreddit,
            data.postCreatedAt,
            now,
            (existing as any).id
          ).run();
          updated++;
        }
      } else {
        // Insert new contact
        await db.prepare(`
          INSERT INTO outreach_contacts (
            username, opportunity_id, fit_score, pain_severity,
            engagement_score, recency_score, source_post_url,
            pain_expressed, subreddit, post_created_at,
            outreach_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          username,
          opportunityId,
          data.fitScore.total,
          data.severity,
          data.fitScore.engagement,
          data.fitScore.recency,
          data.bestUrl,
          data.bestQuote.slice(0, 1000),
          data.subreddit,
          data.postCreatedAt,
          now,
          now
        ).run();
        added++;
      }
    } catch (error) {
      console.error(`Error adding contact ${username}:`, error);
    }
  }
  
  // Get total count
  const totalResult = await db.prepare(`
    SELECT COUNT(*) as count FROM outreach_contacts WHERE opportunity_id = ?
  `).bind(opportunityId).first();
  
  return {
    added,
    updated,
    total: (totalResult as any)?.count || 0
  };
}

/**
 * Get outreach list for an opportunity
 */
export async function getOutreachList(
  db: D1Database,
  opportunityId: number,
  options: {
    status?: OutreachStatus;
    limit?: number;
    sortBy?: 'fit_score' | 'recency' | 'engagement';
  } = {}
): Promise<OutreachContact[]> {
  const { status, limit = 100, sortBy = 'fit_score' } = options;
  
  let query = `
    SELECT * FROM outreach_contacts 
    WHERE opportunity_id = ?
  `;
  
  if (status) {
    query += ` AND outreach_status = '${status}'`;
  }
  
  const sortColumn = sortBy === 'recency' ? 'post_created_at DESC' 
                   : sortBy === 'engagement' ? 'engagement_score DESC'
                   : 'fit_score DESC';
  
  query += ` ORDER BY ${sortColumn} LIMIT ?`;
  
  const result = await db.prepare(query).bind(opportunityId, limit).all();
  
  return (result.results || []).map((r: any) => ({
    id: r.id,
    username: r.username,
    opportunity_id: r.opportunity_id,
    fit_score: r.fit_score,
    pain_severity: r.pain_severity,
    engagement_score: r.engagement_score,
    recency_score: r.recency_score,
    source_post_url: r.source_post_url,
    pain_expressed: r.pain_expressed,
    subreddit: r.subreddit,
    post_created_at: r.post_created_at,
    outreach_status: r.outreach_status as OutreachStatus,
    contacted_at: r.contacted_at,
    responded_at: r.responded_at,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
}

/**
 * Update outreach contact status
 */
export async function updateOutreachStatus(
  db: D1Database,
  contactId: number,
  status: OutreachStatus,
  notes?: string
): Promise<boolean> {
  const now = Date.now();
  
  let query = `
    UPDATE outreach_contacts SET
      outreach_status = ?,
      updated_at = ?
  `;
  
  const params: (string | number | null)[] = [status, now];
  
  if (status === 'contacted') {
    query += `, contacted_at = ?`;
    params.push(now);
  } else if (status === 'responded') {
    query += `, responded_at = ?`;
    params.push(now);
  }
  
  if (notes !== undefined) {
    query += `, notes = ?`;
    params.push(notes);
  }
  
  query += ` WHERE id = ?`;
  params.push(contactId);
  
  try {
    await db.prepare(query).bind(...params).run();
    return true;
  } catch (error) {
    console.error('Error updating outreach status:', error);
    return false;
  }
}

/**
 * Export outreach list as CSV
 */
export async function exportOutreachCSV(
  db: D1Database,
  opportunityId?: number
): Promise<string> {
  let query = `
    SELECT 
      oc.*,
      pc.product_name,
      pc.tagline,
      pc.topic
    FROM outreach_contacts oc
    JOIN pain_clusters pc ON oc.opportunity_id = pc.id
  `;
  
  if (opportunityId) {
    query += ` WHERE oc.opportunity_id = ?`;
  }
  
  query += ` ORDER BY oc.fit_score DESC`;
  
  const stmt = opportunityId 
    ? db.prepare(query).bind(opportunityId)
    : db.prepare(query);
    
  const result = await stmt.all();
  const rows = result.results || [];
  
  // CSV headers
  const headers = [
    'Username',
    'Product',
    'Fit Score',
    'Severity',
    'Engagement',
    'Recency',
    'Status',
    'Pain Expressed',
    'Subreddit',
    'Post URL',
    'Post Date',
    'Contacted At',
    'Notes'
  ].join(',');
  
  // CSV rows
  const csvRows = rows.map((r: any) => {
    const postDate = r.post_created_at 
      ? new Date(r.post_created_at * 1000).toISOString().split('T')[0]
      : '';
    const contactedDate = r.contacted_at 
      ? new Date(r.contacted_at).toISOString().split('T')[0]
      : '';
      
    return [
      `u/${r.username}`,
      `"${(r.product_name || '').replace(/"/g, '""')}"`,
      r.fit_score,
      r.pain_severity || 'medium',
      r.engagement_score,
      r.recency_score,
      r.outreach_status,
      `"${(r.pain_expressed || '').slice(0, 200).replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      r.subreddit || '',
      r.source_post_url || '',
      postDate,
      contactedDate,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });
  
  return [headers, ...csvRows].join('\n');
}

/**
 * Get outreach stats for an opportunity
 */
export async function getOutreachStats(
  db: D1Database,
  opportunityId: number
): Promise<{
  total: number;
  pending: number;
  contacted: number;
  responded: number;
  declined: number;
  avg_fit_score: number;
  top_subreddits: Array<{ subreddit: string; count: number }>;
}> {
  const [countResult, avgResult, subredditResult] = await Promise.all([
    db.prepare(`
      SELECT 
        outreach_status,
        COUNT(*) as count
      FROM outreach_contacts
      WHERE opportunity_id = ?
      GROUP BY outreach_status
    `).bind(opportunityId).all(),
    
    db.prepare(`
      SELECT AVG(fit_score) as avg FROM outreach_contacts WHERE opportunity_id = ?
    `).bind(opportunityId).first(),
    
    db.prepare(`
      SELECT subreddit, COUNT(*) as count 
      FROM outreach_contacts 
      WHERE opportunity_id = ? AND subreddit IS NOT NULL
      GROUP BY subreddit 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(opportunityId).all()
  ]);
  
  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of countResult.results || []) {
    const r = row as any;
    statusCounts[r.outreach_status] = r.count;
    total += r.count;
  }
  
  return {
    total,
    pending: statusCounts['pending'] || 0,
    contacted: statusCounts['contacted'] || 0,
    responded: statusCounts['responded'] || 0,
    declined: statusCounts['declined'] || 0,
    avg_fit_score: Math.round((avgResult as any)?.avg || 0),
    top_subreddits: (subredditResult.results || []).map((r: any) => ({
      subreddit: r.subreddit,
      count: r.count
    }))
  };
}

/**
 * Run outreach list building for all qualifying opportunities
 */
export async function runOutreachListBuilder(env: Env): Promise<{
  opportunities_processed: number;
  contacts_added: number;
  contacts_updated: number;
  total_contacts: number;
}> {
  const db = env.DB;
  
  console.log('\n=== v15 Outreach List Builder ===');
  
  // Get opportunities with 5+ members
  const opportunities = await db.prepare(`
    SELECT id, product_name FROM pain_clusters 
    WHERE social_proof_count >= 5 AND product_name IS NOT NULL
    ORDER BY social_proof_count DESC
    LIMIT 50
  `).all();
  
  const toProcess = opportunities.results || [];
  console.log(`Building outreach lists for ${toProcess.length} opportunities...`);
  
  let totalAdded = 0;
  let totalUpdated = 0;
  let processed = 0;
  
  for (const row of toProcess) {
    const opp = row as any;
    try {
      const result = await buildOutreachList(db, opp.id);
      totalAdded += result.added;
      totalUpdated += result.updated;
      
      if (result.added > 0 || result.updated > 0) {
        console.log(`  ${opp.product_name}: +${result.added} new, ~${result.updated} updated (${result.total} total)`);
      }
      
      processed++;
    } catch (error) {
      console.error(`  Error building list for ${opp.product_name}:`, error);
    }
  }
  
  // Get total count
  const totalResult = await db.prepare(
    `SELECT COUNT(*) as count FROM outreach_contacts`
  ).first();
  
  console.log(`\n=== Outreach List Builder Complete ===`);
  console.log(`Processed: ${processed}, Added: ${totalAdded}, Updated: ${totalUpdated}`);
  
  return {
    opportunities_processed: processed,
    contacts_added: totalAdded,
    contacts_updated: totalUpdated,
    total_contacts: (totalResult as any)?.count || 0
  };
}
