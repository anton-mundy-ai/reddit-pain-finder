// v18 API client - Auth + Alerts + MVP Features + Embedding-based clustering + Competitor Mining + Trends + Market Sizing

import { Alert, AlertStats, AlertType } from './types';

export const API_BASE = 'https://ideas.koda-software.com';

// ===============================
// v18: Auth types
// ===============================

export interface User {
  id: number;
  email: string;
  plan: 'free' | 'pro';
  first_seen: number;
  last_seen: number;
  preferences: Record<string, any>;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: User;
  message?: string;
}

// Feature types
export type FeatureType = 'must_have' | 'nice_to_have' | 'differentiator';

export interface MVPFeature {
  id: number;
  opportunity_id: number;
  feature_name: string;
  feature_type: FeatureType;
  description: string;
  priority_score: number;
  mention_count: number;
  source_quotes: string;  // JSON array
  confidence: number;
  extracted_at: number;
}

export async function fetchOpportunities(
  limit: number = 50, 
  minMentions: number = 5, 
  showAll: boolean = false,
  sortBy: 'mentions' | 'score' | 'market' = 'mentions'
) {
  const params = new URLSearchParams({
    limit: String(limit),
    min: String(minMentions),
    sort: sortBy
  });
  if (showAll) params.set('all', 'true');
  
  const res = await fetch(`${API_BASE}/api/opportunities?${params}`);
  if (!res.ok) throw new Error('Failed to fetch opportunities');
  return res.json();
}

export async function fetchOpportunity(id: number) {
  const res = await fetch(`${API_BASE}/api/opportunities/${id}`);
  if (!res.ok) throw new Error('Failed to fetch opportunity');
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// Fetch pain points for visualization
export async function fetchPainPoints(limit: number = 200) {
  const res = await fetch(`${API_BASE}/api/painpoints?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch pain points');
  return res.json();
}

// Fetch topics for visualization
export async function fetchTopics() {
  const res = await fetch(`${API_BASE}/api/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

// v10: Fetch trends
export async function fetchTrends(options: { status?: string; limit?: number; period?: string } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.period) params.set('period', options.period);
  
  const res = await fetch(`${API_BASE}/api/trends?${params}`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

// v10: Fetch trend history for a topic
export async function fetchTrendHistory(topic: string, days: number = 90) {
  const res = await fetch(`${API_BASE}/api/trends/history/${encodeURIComponent(topic)}?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch trend history');
  return res.json();
}

// v11: Fetch market estimates
export async function fetchMarketEstimates(limit: number = 100, sortBy: 'tam' | 'som' | 'confidence' = 'tam') {
  const res = await fetch(`${API_BASE}/api/market?limit=${limit}&sort=${sortBy}`);
  if (!res.ok) throw new Error('Failed to fetch market estimates');
  return res.json();
}

// v11: Fetch market estimate for a specific opportunity
export async function fetchMarketEstimate(id: number) {
  const res = await fetch(`${API_BASE}/api/market/${id}`);
  if (!res.ok) throw new Error('Failed to fetch market estimate');
  return res.json();
}

// v12: Fetch features for a specific opportunity
export async function fetchOpportunityFeatures(id: number): Promise<{
  features: MVPFeature[];
  grouped: {
    must_have: MVPFeature[];
    nice_to_have: MVPFeature[];
    differentiator: MVPFeature[];
  };
  total: number;
}> {
  const res = await fetch(`${API_BASE}/api/opportunities/${id}/features`);
  if (!res.ok) throw new Error('Failed to fetch opportunity features');
  return res.json();
}

// v12: Fetch all features across opportunities
export async function fetchAllFeatures(limit: number = 100, type?: FeatureType) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (type) params.set('type', type);
  
  const res = await fetch(`${API_BASE}/api/features?${params}`);
  if (!res.ok) throw new Error('Failed to fetch features');
  return res.json();
}

export async function triggerPipeline(step: string) {
  const res = await fetch(`${API_BASE}/api/trigger/${step}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger ${step}`);
  return res.json();
}

// v16: Geographic Analysis API

export type RegionCode = 'AU' | 'US' | 'UK' | 'EU' | 'GLOBAL';

export interface RegionInfo {
  emoji: string;
  name: string;
  color: string;
}

export interface GeoRegionStat {
  region: RegionCode;
  pain_count: number;
  cluster_count: number;
  avg_confidence: number;
  percentage: number;
}

export interface GeoStats {
  regions: GeoRegionStat[];
  total: number;
  regions_info: Record<RegionCode, RegionInfo>;
}

// Fetch geo stats
export async function fetchGeoStats(): Promise<GeoStats> {
  const res = await fetch(`${API_BASE}/api/geo/stats`);
  if (!res.ok) throw new Error('Failed to fetch geo stats');
  return res.json();
}

// Fetch opportunities by region
export async function fetchOpportunitiesByRegion(region: RegionCode, limit: number = 50) {
  const res = await fetch(`${API_BASE}/api/geo/${region}?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch opportunities for region ${region}`);
  return res.json();
}

// Fetch geo breakdown for a specific opportunity
export async function fetchOpportunityGeo(id: number): Promise<{
  breakdown: Record<RegionCode, number>;
  percentages: Record<RegionCode, number>;
  total: number;
  regions_info: Record<RegionCode, RegionInfo>;
}> {
  const res = await fetch(`${API_BASE}/api/opportunities/${id}/geo`);
  if (!res.ok) throw new Error('Failed to fetch opportunity geo breakdown');
  return res.json();
}

// Fetch opportunities with region filter
export async function fetchOpportunitiesWithRegion(
  limit: number = 50, 
  minMentions: number = 5, 
  showAll: boolean = false,
  sortBy: 'mentions' | 'score' | 'market' = 'mentions',
  region?: RegionCode
) {
  const params = new URLSearchParams({
    limit: String(limit),
    min: String(minMentions),
    sort: sortBy
  });
  if (showAll) params.set('all', 'true');
  if (region) params.set('region', region);
  
  const res = await fetch(`${API_BASE}/api/opportunities?${params}`);
  if (!res.ok) throw new Error('Failed to fetch opportunities');
  return res.json();
}

// v13: Landing page types
export interface LandingBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface LandingSocialProof {
  mention_count: number;
  sources: string[];
  quotes: Array<{
    text: string;
    author: string;
    source: string;
  }>;
}

export interface LandingPage {
  id: number;
  opportunity_id: number;
  headline: string;
  subheadline: string;
  benefits: LandingBenefit[];
  social_proof: LandingSocialProof;
  cta_text: string;
  hero_description?: string;
  generated_at: number;
  version: number;
}

// v13: Fetch landing page for a specific opportunity
export async function fetchOpportunityLanding(id: number): Promise<{ landing: LandingPage } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/opportunities/${id}/landing`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch landing page');
    }
    return res.json();
  } catch {
    return null;
  }
}

// v13: Generate landing page for a specific opportunity
export async function generateOpportunityLanding(id: number): Promise<{ success: boolean; landing?: LandingPage }> {
  const res = await fetch(`${API_BASE}/api/trigger/generate-landing/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to generate landing page');
  return res.json();
}

// v13: Fetch all landing pages
export async function fetchAllLandings(limit: number = 100) {
  const res = await fetch(`${API_BASE}/api/landings?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch landing pages');
  return res.json();
}

// ===============================
// v15: Outreach List API
// ===============================

export type OutreachStatus = 'pending' | 'contacted' | 'responded' | 'declined';

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
}

export interface OutreachTemplate {
  type: 'dm' | 'comment' | 'post';
  subject?: string;
  body: string;
  tips: string[];
}

export interface OutreachStats {
  total: number;
  pending: number;
  contacted: number;
  responded: number;
  declined: number;
  avg_fit_score: number;
  top_subreddits: Array<{ subreddit: string; count: number }>;
}

// Fetch outreach list for an opportunity
export async function fetchOutreachList(
  opportunityId: number, 
  options: { status?: OutreachStatus; limit?: number; sort?: string } = {}
): Promise<{ contacts: OutreachContact[]; stats: OutreachStats; templates: OutreachTemplate[] }> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.sort) params.set('sort', options.sort);
  
  const res = await fetch(`${API_BASE}/api/opportunities/${opportunityId}/outreach?${params}`);
  if (!res.ok) throw new Error('Failed to fetch outreach list');
  return res.json();
}

// Update outreach contact status
export async function updateOutreachStatus(
  contactId: number, 
  status: OutreachStatus, 
  notes?: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/outreach/${contactId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes })
  });
  if (!res.ok) throw new Error('Failed to update outreach status');
  return res.json();
}

// Export outreach list as CSV
export function getOutreachExportUrl(opportunityId?: number): string {
  const params = opportunityId ? `?opportunity_id=${opportunityId}` : '';
  return `${API_BASE}/api/outreach/export${params}`;
}

// v14: Alert API functions

export async function fetchAlerts(options: {
  type?: AlertType;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ alerts: Alert[]; stats: AlertStats }> {
  const params = new URLSearchParams();
  if (options.type) params.set('type', options.type);
  if (options.unreadOnly) params.set('unread', 'true');
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  
  const res = await fetch(`${API_BASE}/api/alerts?${params}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchUnreadCount(): Promise<{ unread: number }> {
  const res = await fetch(`${API_BASE}/api/alerts/count`);
  if (!res.ok) throw new Error('Failed to fetch alert count');
  return res.json();
}

export async function markAlertRead(alertId: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/alerts/${alertId}/read`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark alert read');
  return res.json();
}

export async function markAllAlertsRead(): Promise<{ success: boolean; marked: number }> {
  const res = await fetch(`${API_BASE}/api/alerts/read-all`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark all alerts read');
  return res.json();
}

// ===============================
// v18: Auth API
// ===============================

/**
 * Get current authenticated user
 * Returns user info if authenticated via Cloudflare Access, null otherwise
 */
export async function fetchCurrentUser(): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      credentials: 'include'  // Important: include cookies for CF Access
    });
    if (!res.ok) {
      return { authenticated: false };
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching current user:', error);
    return { authenticated: false };
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(preferences: Record<string, any>): Promise<{ success: boolean; preferences: Record<string, any> }> {
  const res = await fetch(`${API_BASE}/api/me/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ preferences })
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}

/**
 * Get logout URL
 * Redirect to this URL to log out from Cloudflare Access
 */
export async function getLogoutUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/logout`);
  const data = await res.json();
  return data.logout_url;
}

/**
 * Initiate logout - redirects to CF Access logout
 */
export async function logout(): Promise<void> {
  const logoutUrl = await getLogoutUrl();
  window.location.href = logoutUrl;
}
