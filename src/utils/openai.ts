// OpenAI API utilities for GPT-5.2 (quality) and GPT-5-nano (volume)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface CallOptions {
  max_completion_tokens?: number;
  json_mode?: boolean;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<{ content: string; tokens: number }> {
  const body: any = {
    model,
    messages,
    max_completion_tokens: options.max_completion_tokens ?? 500,
  };
  
  // GPT-5 models don't support custom temperature - only default 1
  // So we don't include temperature at all
  
  if (options.json_mode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as OpenAIResponse;
  
  return {
    content: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0
  };
}

/**
 * GPT-5-nano: Fast, cheap model for volume tasks
 * Use for: Initial filtering, classification, quick decisions
 */
export async function callGPT5Nano(
  apiKey: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<{ content: string; tokens: number }> {
  return callOpenAI(apiKey, 'gpt-5-nano', messages, options);
}

/**
 * GPT-5.2: High-quality model for nuanced tasks
 * Use for: Synthesis, scoring, validation, quality extraction
 */
export async function callGPT52(
  apiKey: string,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<{ content: string; tokens: number }> {
  return callOpenAI(apiKey, 'gpt-5.2', messages, options);
}

export async function createEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000)
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    data: { embedding: number[] }[];
    usage: { total_tokens: number };
  };

  return data.data[0]?.embedding || [];
}
