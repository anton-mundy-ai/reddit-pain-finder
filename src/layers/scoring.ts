// Layer 6: Scoring - Rank clusters by opportunity potential

import { Env, PainCluster, PainRecord, ScoringResponse } from '../types';
import { callGPT5Nano } from '../utils/openai';
import { getClusterMembers } from './clustering';

const BATCH_SIZE = 10;

const SCORING_PROMPT = `Score this pain point cluster on 6 dimensions (0-100 each).

Respond in JSON:
{
  "frequency": { "score": 0-100, "reasoning": "brief" },
  "severity": { "score": 0-100, "reasoning": "brief" },
  "economic": { "score": 0-100, "reasoning": "brief" },
  "solvability": { "score": 0-100, "reasoning": "brief" },
  "competitive": { "score": 0-100, "reasoning": "brief" },
  "au_fit": { "score": 0-100, "reasoning": "brief" }
}

FREQUENCY: Multiple authors/subreddits = high. SEVERITY: Blocking language, anger = high.
ECONOMIC: B2B, "I'd pay", time-saving = high. SOLVABILITY: Clear problem, no impossible constraints = high.
COMPETITIVE: "nothing works", underserved = high opportunity. AU_FIT: AU locations/context = high.`;

async function scoreCluster(apiKey: string, cluster: PainCluster, members: PainRecord[]): Promise<ScoringResponse | null> {
  const subreddits = [...new Set(members.map(m => m.subreddit))];
  const authors = [...new Set(members.map(m => m.source_author).filter(Boolean))];
  const locations = members.map(m => m.context_location).filter(Boolean);
  const auLocations = locations.filter(l => /australia|melbourne|sydney|brisbane|perth|adelaide|queensland|nsw|victoria/i.test(l || ''));
  
  const severitySignals = members.flatMap(m => { try { return JSON.parse(m.severity_signals || '[]'); } catch { return []; } }).slice(0, 10);
  const w2pHints = members.flatMap(m => { try { return JSON.parse(m.w2p_hints || '[]'); } catch { return []; } }).slice(0, 10);
  const workarounds = members.map(m => m.workaround_text).filter(Boolean).slice(0, 5);
  
  const context = `
CLUSTER: ${cluster.brief_summary || cluster.centroid_text}

Metrics: ${members.length} pain points, ${authors.length} unique authors, ${subreddits.length} subreddits
Avg severity: ${cluster.avg_severity?.toFixed(1) || 'N/A'}/10, Avg W2P: ${cluster.avg_w2p?.toFixed(1) || 'N/A'}/10

AU context: ${auLocations.length > 0 ? auLocations.slice(0, 5).join(', ') : 'None'}
AU subreddits: ${subreddits.filter(s => /australia|melbourne|sydney|brisbane|perth|adelaide|ausfinance/i.test(s)).join(', ') || 'None'}

Severity signals: ${severitySignals.slice(0, 6).map(s => `"${s}"`).join(', ') || 'None'}
Economic signals: ${w2pHints.slice(0, 6).map(s => `"${s}"`).join(', ') || 'None'}
Workarounds: ${workarounds.join('; ') || 'None'}

Sample problems: ${members.slice(0, 4).map((m, i) => `${i + 1}. "${m.problem_text.slice(0, 100)}"`).join('\n')}`;

  try {
    const { content: responseText } = await callGPT5Nano(apiKey,
      [{ role: 'system', content: SCORING_PROMPT }, { role: 'user', content: context }],
      { temperature: 0.2, max_completion_tokens: 600, json_mode: true }
    );
    return JSON.parse(responseText) as ScoringResponse;
  } catch (error) {
    console.error('Scoring error:', error);
    return null;
  }
}

async function storeClusterScore(db: D1Database, clusterId: number, scores: ScoringResponse): Promise<void> {
  const weights = { frequency: 0.15, severity: 0.15, economic: 0.25, solvability: 0.20, competitive: 0.15, au_fit: 0.10 };
  const totalScore = scores.frequency.score * weights.frequency + scores.severity.score * weights.severity +
    scores.economic.score * weights.economic + scores.solvability.score * weights.solvability +
    scores.competitive.score * weights.competitive + scores.au_fit.score * weights.au_fit;
  
  await db.prepare(`
    INSERT OR REPLACE INTO cluster_scores
    (cluster_id, frequency_score, severity_score, economic_score, solvability_score, competitive_score, au_fit_score, total_score, score_breakdown, scored_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(clusterId, scores.frequency.score, scores.severity.score, scores.economic.score,
    scores.solvability.score, scores.competitive.score, scores.au_fit.score,
    totalScore, JSON.stringify(scores), Math.floor(Date.now() / 1000)).run();
}

export async function runScoring(env: Env): Promise<{ scored: number }> {
  const db = env.DB;
  let scored = 0;
  
  const clusters = await db.prepare(`
    SELECT pc.* FROM pain_clusters pc
    LEFT JOIN cluster_scores cs ON cs.cluster_id = pc.id
    WHERE pc.synthesized_at IS NOT NULL AND (cs.cluster_id IS NULL OR pc.updated_at > cs.scored_at)
    ORDER BY pc.member_count DESC LIMIT ?
  `).bind(BATCH_SIZE).all() as D1Result<PainCluster>;
  
  for (const cluster of clusters.results || []) {
    if (!cluster.id) continue;
    const members = await getClusterMembers(db, cluster.id);
    if (members.length === 0) continue;
    
    const scores = await scoreCluster(env.OPENAI_API_KEY, cluster, members);
    if (scores) {
      await storeClusterScore(db, cluster.id, scores);
      scored++;
    }
  }
  
  return { scored };
}

export async function getTopOpportunities(db: D1Database, limit: number = 20, filters?: { minScore?: number; auOnly?: boolean }): Promise<any[]> {
  let query = `
    SELECT pc.*, cs.frequency_score, cs.severity_score, cs.economic_score, cs.solvability_score, cs.competitive_score, cs.au_fit_score, cs.total_score, cs.score_breakdown
    FROM pain_clusters pc JOIN cluster_scores cs ON cs.cluster_id = pc.id WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filters?.minScore) { query += ` AND cs.total_score >= ?`; params.push(filters.minScore); }
  if (filters?.auOnly) { query += ` AND cs.au_fit_score >= 50`; }
  
  query += ` ORDER BY cs.total_score DESC LIMIT ?`;
  params.push(limit);
  
  const result = await db.prepare(query).bind(...params).all();
  return result.results || [];
}
