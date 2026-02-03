/**
 * GPT-5 LLM Utility v3
 * - GPT-5.2 for quality: synthesis, scoring, validation
 * - GPT-5-nano for volume: filtering, classification
 * - All outputs optimized for BREVITY
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Model selection - using GPT-4o family
const MODELS = {
  quality: 'gpt-5.2',      // Synthesis, scoring, validation
  volume: 'gpt-5-nano',   // Filtering, classification
};

export async function callLLM(env, { messages, maxTokens = 1000, jsonMode = false, quality = false }) {
  const apiKey = env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const model = quality ? MODELS.quality : MODELS.volume;
  
  const body = {
    model,
    messages,
    max_completion_tokens: maxTokens,
  };
  
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  console.log(`[${model}] tokens: ${data.usage?.total_tokens || 'n/a'}, finish: ${data.choices[0].finish_reason}`);
  
  if (!content) {
    throw new Error('Empty response from LLM');
  }
  
  return content;
}

/**
 * Classify content as pain point (GPT-5-nano - volume)
 */
export async function classifyContent(env, text, subreddit) {
  const prompt = `Classify this Reddit post.

"${text.slice(0, 1500)}"
r/${subreddit}

JSON:
{
  "is_pain_point": bool,
  "confidence": 0-100,
  "category": "complaint|ask|rant|how_to|other",
  "problem_type": "consumer|business|other"
}

Pain point = frustration, problem, need, solution request.`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Classify pain points. JSON only.' },
      { role: 'user', content: prompt },
    ],
    jsonMode: true,
    quality: false,
  });
  
  return JSON.parse(response);
}

/**
 * Extract structured pain record (GPT-5-nano - volume)
 */
export async function extractPainRecord(env, text, subreddit, context = {}) {
  const prompt = `Extract pain record from Reddit post.

"${text.slice(0, 2000)}"
r/${subreddit}
${context.title ? `Title: "${context.title}"` : ''}

JSON:
{
  "problem_statement": "1 sentence max",
  "persona": "2-3 words (e.g., 'Small biz owner')",
  "context": {
    "industry": "or null",
    "location": "AU locations priority",
    "situation": "brief trigger"
  },
  "severity_signals": ["frustrated", "nightmare", etc],
  "frequency_signals": ["daily", "always", etc],
  "current_workaround": "brief or null",
  "willingness_to_pay": "hints or null"
}`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Extract structured data. Be BRIEF. JSON only.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 1000,
    jsonMode: true,
    quality: false,
  });
  
  return JSON.parse(response);
}

/**
 * Generate opportunity brief (GPT-5.2 - quality)
 * CRITICAL: Output must be SNAPPY - product names, not descriptions
 */
export async function generateOpportunityBrief(env, painRecords) {
  const examples = painRecords.slice(0, 8).map((r, i) => 
    `${i + 1}. [r/${r.subreddit}] "${(r.problem_statement || r.problem_text || '').slice(0, 150)}" - ${r.persona || 'user'}`
  ).join('\n');
  
  const prompt = `Analyze these pain points. Create SNAPPY opportunity brief.

${examples}

CRITICAL: Be BRIEF. Product names, not descriptions.

JSON:
{
  "product_name": "2-4 word product name (e.g., 'Founder Focus Tool', 'Invoice Ninja', 'Fleet Tracker')",
  "summary": "1-2 sentences MAX. What problem does this solve?",
  "personas": ["3 word max each", "Small biz owner", "Remote worker"],
  "workarounds": ["1-3 words each", "Spreadsheets", "Manual tracking"],
  "market_size": "tiny|small|medium|large",
  "au_relevance": "low|medium|high"
}

NO long-winded explanations. Snappy. Brief. Punchy.`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Product strategist. BRIEF outputs only. No fluff.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 800,
    jsonMode: true,
    quality: true,
  });
  
  const brief = JSON.parse(response);
  
  // Backwards compatibility
  brief.common_personas = brief.personas;
  brief.common_workarounds = brief.workarounds;
  brief.suggested_name = brief.product_name;
  
  return brief;
}

/**
 * Score a cluster (GPT-5.2 - quality)
 */
export async function scoreCluster(env, brief, records) {
  const subreddits = [...new Set(records.map(r => r.subreddit))].join(', ');
  const quotes = records.slice(0, 4).map(r => 
    `- "${(r.problem_statement || r.problem_text || '').slice(0, 100)}"`
  ).join('\n');

  const prompt = `Score this opportunity (0-100 each).

Product: ${brief.product_name || brief.suggested_name || 'Unknown'}
Summary: ${brief.summary || 'N/A'}
Mentions: ${records.length}
Personas: ${(brief.personas || brief.common_personas || []).join(', ')}
Subreddits: ${subreddits}
Quotes:
${quotes}

JSON:
{
  "frequency": {"score": 0-100, "reason": "10 words max"},
  "severity": {"score": 0-100, "reason": "10 words max"},
  "economic_value": {"score": 0-100, "reason": "10 words max"},
  "solvability": {"score": 0-100, "reason": "10 words max"},
  "competition": {"score": 0-100, "reason": "10 words max - high=opportunity"},
  "au_fit": {"score": 0-100, "reason": "10 words max"}
}`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Market analyst. Score opportunities. Brief reasons only.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 600,
    jsonMode: true,
    quality: true,
  });
  
  return JSON.parse(response);
}

/**
 * Validate an idea against pain points (GPT-5.2 - quality)
 */
export async function validateIdea(env, ideaText, matchingPainPoints) {
  const painPointsList = matchingPainPoints.slice(0, 10).map((p, i) => 
    `${i + 1}. [r/${p.subreddit}] "${(p.problem_text || '').slice(0, 150)}" (severity: ${p.severity_score || 'n/a'})`
  ).join('\n');

  const prompt = `Validate this business idea against real pain points.

IDEA: "${ideaText}"

MATCHING PAIN POINTS (${matchingPainPoints.length} found):
${painPointsList || 'None found'}

JSON:
{
  "validation_score": 0-100,
  "confidence": 0-100,
  "verdict": "strong|moderate|weak|no_match",
  "market_signals": ["brief signal 1", "brief signal 2"],
  "concerns": ["brief concern 1"],
  "suggested_pivot": "brief suggestion or null",
  "search_queries": ["reddit search query 1", "query 2"]
}

High score = many matching pain points with high severity.
Include search queries to find more validation data.`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Idea validator. Match ideas to real pain points. Be honest and brief.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 600,
    jsonMode: true,
    quality: true,
  });
  
  return JSON.parse(response);
}

/**
 * Back-validate a cluster - find more supporting evidence (GPT-5.2 - quality)
 */
export async function generateBackValidationQueries(env, cluster) {
  const prompt = `Generate Reddit search queries to validate this opportunity.

Product: ${cluster.product_name || cluster.centroid_text || 'Unknown'}
Summary: ${cluster.brief_summary || 'N/A'}
Personas: ${cluster.brief_personas || 'N/A'}

JSON:
{
  "queries": ["search query 1", "search query 2", "search query 3"],
  "target_subreddits": ["subreddit1", "subreddit2"],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Generate 3-5 specific search queries that would find more people with this problem.`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Generate Reddit search queries. Brief and specific.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 400,
    jsonMode: true,
    quality: true,
  });
  
  return JSON.parse(response);
}

/**
 * Quick semantic similarity check (GPT-5-nano - volume)
 */
export async function checkSimilarity(env, text1, text2) {
  const prompt = `Rate similarity of these problems (0-100).

A: "${text1.slice(0, 300)}"
B: "${text2.slice(0, 300)}"

JSON: {"similarity": 0-100}`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'Rate semantic similarity. JSON only.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 50,
    jsonMode: true,
    quality: false,
  });
  
  return JSON.parse(response).similarity;
}
