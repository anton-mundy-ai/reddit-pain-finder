// Layer 5: Synthesis - Generate opportunity briefs for clusters

import { Env, PainCluster, PainRecord, SynthesisResponse } from '../types';
import { callGPT4oMini } from '../utils/openai';
import { getClustersNeedingSynthesis, getClusterMembers } from './clustering';

const BATCH_SIZE = 5;

const SYNTHESIS_PROMPT = `Create an opportunity brief from this cluster of related pain points.

Respond in JSON:
{
  "summary": "1-3 sentence summary of the opportunity/problem space",
  "personas": ["list of distinct personas affected"],
  "common_workarounds": ["list of workarounds people currently use"],
  "open_questions": ["questions needing answers before building a solution"]
}

Make summary actionable, personas specific (not just "users"), workarounds show competitive landscape.`;

interface Quote {
  text: string;
  url: string;
  author: string;
  score: number;
}

async function synthesizeCluster(apiKey: string, cluster: PainCluster, members: PainRecord[]): Promise<{
  synthesis: SynthesisResponse | null;
  quotes: Quote[];
}> {
  const quotes: Quote[] = members
    .filter(m => m.problem_text && m.source_url)
    .sort((a, b) => (b.source_score || 0) - (a.source_score || 0))
    .slice(0, 10)
    .map(m => ({ text: m.problem_text.slice(0, 300), url: m.source_url || '', author: m.source_author || 'anonymous', score: m.source_score || 0 }));
  
  const memberSummaries = members.slice(0, 15).map((m, i) => 
    `${i + 1}. "${m.problem_text}" (${m.persona || 'unknown'}, r/${m.subreddit})`
  ).join('\n');
  
  const workarounds = members.filter(m => m.workaround_text).map(m => m.workaround_text).slice(0, 5);
  
  const context = `
Cluster: ${members.length} pain points.
Representative: ${cluster.centroid_text}

Samples:
${memberSummaries}

Workarounds: ${workarounds.length > 0 ? workarounds.join('\n') : 'None mentioned'}
Avg severity: ${cluster.avg_severity?.toFixed(1) || 'N/A'}, Avg W2P: ${cluster.avg_w2p?.toFixed(1) || 'N/A'}`;

  try {
    const { content: responseText } = await callGPT4oMini(apiKey,
      [{ role: 'system', content: SYNTHESIS_PROMPT }, { role: 'user', content: context }],
      { temperature: 0.3, max_tokens: 500, json_mode: true }
    );
    return { synthesis: JSON.parse(responseText) as SynthesisResponse, quotes };
  } catch (error) {
    console.error('Synthesis error:', error);
    return { synthesis: null, quotes };
  }
}

async function updateClusterSynthesis(db: D1Database, clusterId: number, synthesis: SynthesisResponse, quotes: Quote[]): Promise<void> {
  await db.prepare(`
    UPDATE pain_clusters SET brief_summary = ?, brief_quotes = ?, brief_personas = ?, brief_workarounds = ?, brief_open_questions = ?, synthesized_at = ?
    WHERE id = ?
  `).bind(synthesis.summary, JSON.stringify(quotes), JSON.stringify(synthesis.personas),
    JSON.stringify(synthesis.common_workarounds), JSON.stringify(synthesis.open_questions),
    Math.floor(Date.now() / 1000), clusterId).run();
}

export async function runSynthesis(env: Env): Promise<{ synthesized: number }> {
  const db = env.DB;
  let synthesized = 0;
  
  const clusters = await getClustersNeedingSynthesis(db, BATCH_SIZE);
  
  for (const cluster of clusters) {
    if (!cluster.id) continue;
    const members = await getClusterMembers(db, cluster.id);
    if (members.length === 0) continue;
    
    const { synthesis, quotes } = await synthesizeCluster(env.OPENAI_API_KEY, cluster, members);
    if (synthesis) {
      await updateClusterSynthesis(db, cluster.id, synthesis, quotes);
      synthesized++;
    }
  }
  
  return { synthesized };
}
