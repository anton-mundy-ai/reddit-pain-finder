// v7: Embedding utilities for semantic clustering
// Uses text-embedding-3-small (1536 dimensions)
// Falls back to D1 storage since Vectorize API permissions are missing

export interface Embedding {
  id: number;
  pain_record_id: number;
  vector: number[];  // 1536 dimensions
  created_at: number;
}

export interface SimilarRecord {
  pain_record_id: number;
  similarity: number;
  cluster_id: number | null;
  normalized_topic: string | null;
}

/**
 * Generate embedding using OpenAI text-embedding-3-small
 * Cost: ~$0.00002 per 1K tokens (~$0.0001 per pain point)
 */
export async function generateEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  // Truncate to ~8000 chars to stay under token limit
  const truncated = text.slice(0, 8000);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncated
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

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store embedding in D1 (compressed as JSON)
 */
export async function storeEmbedding(
  db: D1Database,
  painRecordId: number,
  vector: number[]
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  
  // Compress vector to 4 decimal places to save space
  const compressed = vector.map(v => Math.round(v * 10000) / 10000);
  
  await db.prepare(`
    INSERT OR REPLACE INTO embeddings (pain_record_id, vector, created_at)
    VALUES (?, ?, ?)
  `).bind(painRecordId, JSON.stringify(compressed), now).run();
  
  const result = await db.prepare(
    "SELECT id FROM embeddings WHERE pain_record_id = ?"
  ).bind(painRecordId).first() as { id: number } | null;
  
  return result?.id || 0;
}

/**
 * Find similar pain records using embeddings
 * Returns top N matches with similarity scores
 */
export async function findSimilarRecords(
  db: D1Database,
  targetVector: number[],
  excludeRecordId: number,
  limit: number = 10,
  minSimilarity: number = 0.75
): Promise<SimilarRecord[]> {
  // Get all embeddings with their cluster info
  const result = await db.prepare(`
    SELECT e.pain_record_id, e.vector, pr.cluster_id, pr.normalized_topic
    FROM embeddings e
    JOIN pain_records pr ON e.pain_record_id = pr.id
    WHERE e.pain_record_id != ?
  `).bind(excludeRecordId).all();
  
  const records = result.results || [];
  
  // Calculate similarities
  const similarities: SimilarRecord[] = [];
  
  for (const record of records) {
    try {
      const vector = JSON.parse((record as any).vector as string) as number[];
      const similarity = cosineSimilarity(targetVector, vector);
      
      if (similarity >= minSimilarity) {
        similarities.push({
          pain_record_id: (record as any).pain_record_id,
          similarity,
          cluster_id: (record as any).cluster_id,
          normalized_topic: (record as any).normalized_topic
        });
      }
    } catch {
      // Skip invalid vectors
    }
  }
  
  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  return similarities.slice(0, limit);
}

/**
 * Get embedding for a pain record
 */
export async function getEmbedding(
  db: D1Database,
  painRecordId: number
): Promise<number[] | null> {
  const result = await db.prepare(`
    SELECT vector FROM embeddings WHERE pain_record_id = ?
  `).bind(painRecordId).first() as { vector: string } | null;
  
  if (!result) return null;
  
  try {
    return JSON.parse(result.vector) as number[];
  } catch {
    return null;
  }
}

/**
 * Get all embeddings for batch similarity computation
 */
export async function getAllEmbeddings(
  db: D1Database
): Promise<Map<number, number[]>> {
  const result = await db.prepare(`
    SELECT pain_record_id, vector FROM embeddings
  `).all();
  
  const embeddings = new Map<number, number[]>();
  
  for (const row of result.results || []) {
    try {
      const vector = JSON.parse((row as any).vector as string) as number[];
      embeddings.set((row as any).pain_record_id, vector);
    } catch {
      // Skip invalid
    }
  }
  
  return embeddings;
}

/**
 * Batch generate embeddings for multiple texts
 * More efficient than single calls
 */
export async function generateEmbeddingsBatch(
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  // Truncate each text
  const truncated = texts.map(t => t.slice(0, 8000));
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncated
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    data: { embedding: number[]; index: number }[];
    usage: { total_tokens: number };
  };

  // Sort by index to maintain order
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map(d => d.embedding);
}
