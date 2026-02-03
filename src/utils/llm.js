/**
 * GPT-5-nano LLM Utility
 * Handles all OpenAI API calls using gpt-5-nano model
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function callLLM(env, { messages, temperature = 0.3, maxTokens = 1000, jsonMode = false }) {
  const apiKey = env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const body = {
    model: 'gpt-5-nano',
    messages,
    temperature,
    // GPT-5 uses max_completion_tokens instead of max_tokens
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
  return data.choices[0].message.content;
}

/**
 * Classify content as pain point or not
 */
export async function classifyContent(env, text, subreddit) {
  const prompt = `Analyze this Reddit post/comment and classify it.

Text: "${text}"
Subreddit: r/${subreddit}

Respond in JSON format:
{
  "is_pain_point": boolean,
  "confidence": 0-100,
  "category": "complaint" | "recommendation_ask" | "rant" | "how_to" | "other",
  "problem_type": "consumer" | "business" | "other",
  "reason": "brief explanation"
}

Rules:
- is_pain_point: true if person expresses frustration, problem, need, or asks for solution
- consumer: personal/household problems
- business: company operations, B2B, professional challenges
- complaint: expressing dissatisfaction
- recommendation_ask: asking for product/service recommendations (indicates unmet need)
- rant: emotional venting without clear problem
- how_to: asking how to do something (skill gap, not pain point unless frustrated)`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'You are an analyst identifying pain points and unmet needs from Reddit discussions. Be thorough but precise.' },
      { role: 'user', content: prompt },
    ],
    jsonMode: true,
  });
  
  return JSON.parse(response);
}

/**
 * Extract structured pain record from content
 */
export async function extractPainRecord(env, text, subreddit, context = {}) {
  const prompt = `Extract a structured pain record from this Reddit content.

Text: "${text}"
Subreddit: r/${subreddit}
${context.title ? `Post Title: "${context.title}"` : ''}

Respond in JSON format:
{
  "problem_statement": "1-2 sentence summary of the core problem",
  "persona": "who has this problem (e.g., 'small business owner', 'Australian farmer', 'remote worker')",
  "context": {
    "industry": "relevant industry or null",
    "location": "location if mentioned (prioritize Australian locations)",
    "situation": "specific situation or trigger"
  },
  "severity_signals": ["list of words/phrases indicating severity"],
  "frequency_signals": ["list of words/phrases indicating how often this occurs"],
  "current_workaround": "what they're currently doing about it, or null",
  "willingness_to_pay": "any hints about budget/spending, or null",
  "constraints": ["limitations they mention"]
}

Rules:
- Focus on the actual problem, not the symptom
- Preserve Australian context (AU, Aus, Brisbane, Melbourne, etc.)
- Look for severity: "frustrated", "impossible", "nightmare", "urgent", "critical"
- Look for frequency: "every time", "always", "constantly", "weekly", "daily"
- Workaround might be manual processes, spreadsheets, hiring help, etc.
- WTP hints: mentions of budget, "I'd pay", "worth any price", specific dollar amounts`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'You are an expert at analyzing customer pain points from social media. Extract structured data precisely.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 800,
    jsonMode: true,
  });
  
  return JSON.parse(response);
}

/**
 * Generate opportunity brief from cluster
 */
export async function generateOpportunityBrief(env, painRecords) {
  const examples = painRecords.slice(0, 10).map((r, i) => 
    `${i + 1}. [r/${r.subreddit}] "${r.problem_statement}" - ${r.persona || 'unknown'}`
  ).join('\n');
  
  const prompt = `Analyze these related pain points and generate an opportunity brief.

Pain Points:
${examples}

Respond in JSON format:
{
  "summary": "1-3 sentence summary of the opportunity",
  "common_personas": ["list of affected personas"],
  "common_workarounds": ["current solutions people use"],
  "impact_indicators": {
    "frequency": "how often this problem occurs",
    "time_impact": "time wasted/lost",
    "money_impact": "financial impact if mentioned",
    "emotional_impact": "frustration level"
  },
  "suggested_name": "short name for this opportunity cluster"
}`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'You are a product strategist identifying market opportunities from user pain points.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 600,
    jsonMode: true,
  });
  
  return JSON.parse(response);
}

/**
 * Score a cluster on multiple factors
 */
export async function scoreCluster(env, brief, records) {
  const context = `
Opportunity: ${brief.summary}
Number of mentions: ${records.length}
Personas: ${brief.common_personas?.join(', ') || 'various'}
Subreddits: ${[...new Set(records.map(r => r.subreddit))].join(', ')}
Sample quotes:
${records.slice(0, 5).map(r => `- "${r.problem_statement}"`).join('\n')}
`;

  const prompt = `Score this opportunity on multiple factors (0-100 each).

${context}

Respond in JSON format:
{
  "frequency": {
    "score": 0-100,
    "reasoning": "why this score"
  },
  "severity": {
    "score": 0-100,
    "reasoning": "based on urgency/blocking language"
  },
  "economic_value": {
    "score": 0-100,
    "reasoning": "B2B potential, money/time savings"
  },
  "solvability": {
    "score": 0-100,
    "reasoning": "is this a clear, solvable problem?"
  },
  "competition": {
    "score": 0-100,
    "reasoning": "gap in existing solutions (high = good opportunity)"
  },
  "au_fit": {
    "score": 0-100,
    "reasoning": "relevance to Australian market"
  }
}

Scoring guidance:
- frequency: unique authors, cross-subreddit mentions, trending
- severity: urgency words, blocking work, emotional intensity
- economic_value: B2B > B2C, explicit money mentions, time savings
- solvability: clear problem > vague frustration
- competition: "nothing works" = high, many existing tools = low
- au_fit: Australian locations, local regulations, AU-specific context`;

  const response = await callLLM(env, {
    messages: [
      { role: 'system', content: 'You are a market analyst scoring business opportunities.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 800,
    jsonMode: true,
  });
  
  return JSON.parse(response);
}
