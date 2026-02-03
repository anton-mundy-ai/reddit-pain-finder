import { Opportunity, OpportunityDetail, PainRecord, Stats } from './types';

// @ts-ignore
const API_BASE = typeof import.meta !== 'undefined' && import.meta.env?.PROD ? '' : '';

export async function fetchOpportunities(params?: {
  limit?: number;
  minScore?: number;
  auOnly?: boolean;
}): Promise<Opportunity[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.minScore) searchParams.set('minScore', params.minScore.toString());
  if (params?.auOnly) searchParams.set('auOnly', 'true');
  
  const url = `${API_BASE}/api/opportunities?${searchParams}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch opportunities');
  const data = await response.json();
  return data.opportunities || [];
}

export async function fetchOpportunity(id: number): Promise<{
  opportunity: OpportunityDetail;
  members: PainRecord[];
}> {
  const response = await fetch(`${API_BASE}/api/opportunities/${id}`);
  if (!response.ok) throw new Error('Failed to fetch opportunity');
  return response.json();
}

export async function fetchStats(): Promise<Stats> {
  const response = await fetch(`${API_BASE}/api/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}
