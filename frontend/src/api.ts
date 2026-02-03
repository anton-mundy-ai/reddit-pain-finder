// v5 API client

const API_BASE = 'https://ideas.koda-software.com';

export async function fetchOpportunities(limit: number = 20) {
  const res = await fetch(`${API_BASE}/api/opportunities?limit=${limit}`);
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

export async function triggerPipeline(step: string) {
  const res = await fetch(`${API_BASE}/api/trigger/${step}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger ${step}`);
  return res.json();
}
