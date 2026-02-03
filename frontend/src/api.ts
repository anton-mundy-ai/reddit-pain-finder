// v9 API client - Embedding-based clustering + Competitor Mining

export const API_BASE = 'https://ideas.koda-software.com';

export async function fetchOpportunities(limit: number = 50, minMentions: number = 5, showAll: boolean = false) {
  const params = new URLSearchParams({
    limit: String(limit),
    min: String(minMentions)
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

export async function triggerPipeline(step: string) {
  const res = await fetch(`${API_BASE}/api/trigger/${step}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger ${step}`);
  return res.json();
}
