const { GoogleGenerativeAI } = require('@google/generative-ai');

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'gemini';
const EMBEDDING_DIMENSION = 768;

// ─── Gemini Embeddings ────────────────────────────────────
let genAI;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for embeddings');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

async function embedWithGemini(texts) {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'text-embedding-004' });

  const embeddings = [];
  // Gemini supports batch embedding — process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await model.batchEmbedContents({
      requests: batch.map(text => ({
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      })),
    });
    for (const emb of result.embeddings) {
      embeddings.push(emb.values);
    }
  }
  return embeddings;
}

async function embedQueryWithGemini(text) {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_QUERY',
  });
  return result.embedding.values;
}

// ─── Ollama Embeddings ────────────────────────────────────
async function embedWithOllama(texts) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

  const embeddings = [];
  for (const text of texts) {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.status}`);
    }
    const data = await response.json();
    embeddings.push(data.embeddings[0]);
  }
  return embeddings;
}

async function embedQueryWithOllama(text) {
  const results = await embedWithOllama([text]);
  return results[0];
}

// ─── Public API ───────────────────────────────────────────

/**
 * Generate embeddings for an array of text chunks.
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  if (texts.length === 0) return [];

  if (EMBEDDING_PROVIDER === 'ollama') {
    return embedWithOllama(texts);
  }
  return embedWithGemini(texts);
}

/**
 * Generate embedding for a single query (uses RETRIEVAL_QUERY task type for Gemini).
 * @param {string} text - Query text
 * @returns {Promise<number[]>} - Single embedding vector
 */
async function generateQueryEmbedding(text) {
  if (EMBEDDING_PROVIDER === 'ollama') {
    return embedQueryWithOllama(text);
  }
  return embedQueryWithGemini(text);
}

module.exports = {
  generateEmbeddings,
  generateQueryEmbedding,
  EMBEDDING_DIMENSION,
};
