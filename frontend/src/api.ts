// v11 API client - Embedding-based clustering + Competitor Mining + Trends + Market Sizing

export const API_BASE = 'https://ideas.koda-software.com';

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

export async function triggerPipeline(step: string) {
  const res = await fetch(`${API_BASE}/api/trigger/${step}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger ${step}`);
  return res.json();
}
