// OpenAI API utilities for GPT-5-nano

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

export async function callGPT5Nano(
  apiKey: string,
  messages: ChatMessage[],
  options: {
    temperature?: number;
    max_completion_tokens?: number;
    json_mode?: boolean;
  } = {}
): Promise<{ content: string; tokens: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages,
      temperature: options.temperature ?? 0.1,
      max_completion_tokens: options.max_completion_tokens ?? 500,
      response_format: options.json_mode ? { type: 'json_object' } : undefined
    })
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
