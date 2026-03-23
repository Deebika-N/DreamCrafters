const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const prisma = require('./prisma');
const { generateEmbeddings } = require('./embeddingService');

// ─── Config ───────────────────────────────────────────────
const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE, 10) || 500;     // chars (~125 tokens)
const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP, 10) || 50; // chars overlap

// ─── Text Extraction ──────────────────────────────────────

async function extractText(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      return data.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

// ─── Text Chunking ────────────────────────────────────────

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  // Clean up the text
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= chunkSize) {
    return [cleaned];
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Try to break at a sentence boundary
    if (end < cleaned.length) {
      const slice = cleaned.substring(start, end + 100); // look a bit ahead
      const lastPeriod = slice.lastIndexOf('. ');
      const lastNewline = slice.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > chunkSize * 0.5) {
        end = start + breakPoint + 1;
      }
    }

    const chunk = cleaned.substring(start, Math.min(end, cleaned.length)).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    const nextStart = Math.min(end, cleaned.length);
    if (nextStart >= cleaned.length) break;

    // Advance start, ensuring we move forward even with overlap
    start = nextStart - overlap;
    if (start >= nextStart) {
      start = nextStart;
    }
  }

  return chunks;
}

// ─── Full RAG Pipeline ────────────────────────────────────

/**
 * Process an uploaded document: extract text → chunk → embed → store.
 * Runs async after upload response is sent.
 * @param {number} documentId - The RagDocument ID to process
 */
async function processDocument(documentId) {
  try {
    const doc = await prisma.ragDocument.findUnique({ where: { id: documentId } });
    if (!doc) return;

    // Step 1: Extract text
    console.log(`[RAG] Extracting text from ${doc.originalName}...`);
    const text = await extractText(doc.filePath, doc.mimeType);

    if (!text || text.trim().length < 10) {
      await prisma.ragDocument.update({
        where: { id: documentId },
        data: { status: 'failed' },
      });
      console.error(`[RAG] No extractable text in ${doc.originalName}`);
      return;
    }

    // Step 2: Chunk text
    console.log(`[RAG] Chunking text (${text.length} chars)...`);
    const chunks = chunkText(text);
    console.log(`[RAG] Created ${chunks.length} chunks`);

    // Step 3: Generate embeddings
    console.log(`[RAG] Generating embeddings for ${chunks.length} chunks...`);
    const embeddings = await generateEmbeddings(chunks);

    // Step 4: Store chunks with embeddings using raw SQL (Prisma doesn't support vector type natively)
    console.log(`[RAG] Storing chunks in database...`);
    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
        documentId,
        i,
        chunks[i],
        embeddingStr,
        JSON.stringify({ char_count: chunks[i].length }),
      );
    }

    // Step 5: Update document status
    await prisma.ragDocument.update({
      where: { id: documentId },
      data: { status: 'ready', totalChunks: chunks.length },
    });

    console.log(`[RAG] ✅ ${doc.originalName} processed: ${chunks.length} chunks embedded`);
  } catch (err) {
    console.error(`[RAG] ❌ Error processing document ${documentId}:`, err.message);
    await prisma.ragDocument.update({
      where: { id: documentId },
      data: { status: 'failed' },
    }).catch(() => {});
  }
}

// ─── Vector Search ────────────────────────────────────────

/**
 * Search for relevant chunks across the given documents.
 * @param {number[]} documentIds - Document IDs to search within
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array<{id, documentId, chunkIndex, content, similarity, metadata}>>}
 */
async function searchChunks(documentIds, queryEmbedding, topK = 5) {
  if (!documentIds.length) return [];

  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const placeholders = documentIds.map((_, i) => `$${i + 3}`).join(', ');

  const results = await prisma.$queryRawUnsafe(
    `SELECT
       rc.id,
       rc.document_id AS "documentId",
       rc.chunk_index AS "chunkIndex",
       rc.content,
       rc.metadata,
       rd.original_name AS "documentName",
       1 - (rc.embedding <=> $1::vector) AS similarity
     FROM rag_chunks rc
     JOIN rag_documents rd ON rc.document_id = rd.id
     WHERE rc.document_id IN (${placeholders})
     ORDER BY rc.embedding <=> $1::vector
     LIMIT $2`,
    embeddingStr,
    topK,
    ...documentIds,
  );

  return results;
}

module.exports = {
  processDocument,
  searchChunks,
  extractText,
  chunkText,
};
