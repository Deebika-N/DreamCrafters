const Groq = require('groq-sdk');
const prisma = require('./prisma');
const { generateQueryEmbedding } = require('./embeddingService');
const { searchChunks } = require('./ragService');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const MAX_HISTORY = parseInt(process.env.CHAT_HISTORY_LIMIT, 10) || 20;

// ─── System prompt builder ────────────────────────────────
function buildSystemPrompt(userProfile, sessionType, sessionContext, ragContext = []) {
  let prompt = `You are DreamBot, an intelligent and friendly AI study assistant for the DreamCrafters educational platform.
You help students with career guidance, study planning, content recommendations, and general academic support.
Be concise, encouraging, and actionable in your responses. Use bullet points when listing items.
Always respond in the same language the student uses.`;

  // RAG Context (Grounding)
  if (ragContext && ragContext.length > 0) {
    prompt += `\n\n## Documents Context
You have access to the following information from the student's uploaded documents. 
When answering, specifically refer to this information if relevant. 
If the answer is found in the documents, mention the source document name.
If you don't know the answer from the documents, you can use your general knowledge but clarify it's not from the provided materials.

### Extracted Relevant Chunks:
${ragContext.map((c, i) => `[Source: ${c.documentName}] ${c.content}`).join('\n\n')}`;
  }

  // Session-type specific instructions
  const typeInstructions = {
    career: `\nThe student is seeking CAREER GUIDANCE. Focus on career paths, required skills, industry trends, and actionable next steps. Reference career paths available on the platform when possible.`,
    study: `\nThe student needs STUDY HELP. Focus on study tips, content recommendations, study plan suggestions, and learning strategies. Reference their study progress when available.`,
    navigation: `\nThe student needs PLATFORM NAVIGATION help. Guide them on how to use DreamCrafters features: study planner, content library, career paths, webinars, mentorship, and bookmarks. Be specific about where to find things.`,
    general: `\nProvide general helpful assistance. You can help with career guidance, study tips, platform navigation, or just friendly conversation.`,
  };
  prompt += typeInstructions[sessionType] || typeInstructions.general;

  // Inject user profile (Layer 3: long-term memory)
  if (userProfile) {
    const parts = [];
    if (userProfile.interests?.length) {
      parts.push(`Interests: ${userProfile.interests.join(', ')}`);
    }
    if (userProfile.preferences) {
      const p = userProfile.preferences;
      if (p.learningStyle) parts.push(`Learning style: ${p.learningStyle}`);
      if (p.difficultyPreference) parts.push(`Difficulty preference: ${p.difficultyPreference}`);
      if (p.dailyStudyHours) parts.push(`Daily study hours: ${p.dailyStudyHours}`);
    }
    if (userProfile.careerMatch) {
      parts.push(`Recommended career: ${userProfile.careerMatch}`);
    }
    if (userProfile.activePlan) {
      parts.push(`Active study plan: "${userProfile.activePlan.title}" (${userProfile.activePlan.progress}% complete)`);
    }
    if (parts.length > 0) {
      prompt += `\n\n## Student Profile\n${parts.map(p => `- ${p}`).join('\n')}`;
    }
  }

  // Inject session context (Layer 2: working memory)
  if (sessionContext && Object.keys(sessionContext).length > 0) {
    if (sessionContext.current_topic) {
      prompt += `\n\nThe current conversation topic is: ${sessionContext.current_topic}`;
    }
  }

  prompt += `\n\nIMPORTANT: Along with your reply, you MUST also return a JSON object on the LAST line of your response in this exact format:
{"intent": "<detected_intent>", "confidence": <0.0-1.0>, "quick_replies": ["suggestion1", "suggestion2", "suggestion3"], "topic": "<current_topic>"}
Valid intents: greeting, career_guidance, study_help, navigation, motivation, mentorship, webinar, document_qa, fallback
The quick_replies should be 2-3 short actionable suggestions the student can click.
The topic should be a short description of the current conversation topic.
Only the LAST line should be JSON. Everything before it is your response to the student.`;

  return prompt;
}

// ─── Fetch user profile (Layer 3) ─────────────────────────
async function fetchUserProfile(userId) {
  try {
    const [interests, preferences, profile, activePlan] = await Promise.all([
      // Interests
      prisma.userInterest.findMany({
        where: { userId },
        select: { interest: true },
      }),
      // Learning preferences
      prisma.userLearningPreference.findUnique({
        where: { userId },
        select: {
          learningStyle: true,
          difficultyPreference: true,
          dailyStudyHours: true,
          preferredLanguage: true,
        },
      }),
      // Personalization profile
      prisma.personalizationProfile.findUnique({
        where: { userId },
        include: { careerPath: { select: { title: true } } },
      }),
      // Active study plan
      prisma.studyPlan.findFirst({
        where: { userId, status: 'active' },
        select: { title: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const result = {};

    if (interests.length > 0) {
      result.interests = interests.map(i => i.interest);
    }
    if (preferences) {
      result.preferences = preferences;
    }
    if (profile?.careerPath) {
      result.careerMatch = profile.careerPath.title;
    }
    if (activePlan) {
      // Get progress for the active plan
      const sessions = await prisma.studySession.aggregate({
        where: { plan: { userId, status: 'active' } },
        _count: { id: true },
      });
      const completed = await prisma.studySession.aggregate({
        where: { plan: { userId, status: 'active' }, status: 'completed' },
        _count: { id: true },
      });
      const total = sessions._count.id || 0;
      const done = completed._count.id || 0;
      result.activePlan = {
        title: activePlan.title,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.error('Error fetching user profile for chat:', err.message);
    return null;
  }
}

// ─── Parse bot response to extract metadata ───────────────
function parseResponse(responseText) {
  const lines = responseText.trim().split('\n');
  let metadata = { intent: 'fallback', confidence: 0.5, quick_replies: [], topic: null };
  let reply = responseText;

  // Try to find JSON on the last line
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
    const line = lines[i].trim();
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.intent) {
          metadata = {
            intent: parsed.intent || 'fallback',
            confidence: Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.5)),
            quick_replies: Array.isArray(parsed.quick_replies) ? parsed.quick_replies.slice(0, 5) : [],
            topic: parsed.topic || null,
          };
          // Remove the JSON line from the reply
          reply = lines.slice(0, i).join('\n').trim();
          break;
        }
      } catch {
        // Not valid JSON, keep trying
      }
    }
  }

  return { reply, metadata };
}

// ─── Main function: generate chat response ────────────────
/**
 * @param {object} params
 * @param {string} params.userMessage - The user's new message
 * @param {number} params.userId - User ID for profile lookup
 * @param {string} params.sessionType - general | career | study | navigation | rag
 * @param {object|null} params.sessionContext - Current session context JSONB
 * @param {Array} params.conversationHistory - Previous messages [{role, message}]
 * @param {number[]} [params.documentIds] - Optional Document IDs for RAG
 * @returns {Promise<{reply: string, metadata: object, updatedContext: object}>}
 */
async function generateChatResponse({ userMessage, userId, sessionType, sessionContext, conversationHistory, documentIds }) {
  // Layer 3: Fetch user profile for long-term memory
  const userProfile = await fetchUserProfile(userId);

  // Buffer for RAG retrieval results
  let retrievedChunks = [];
  let sources = [];

  // RAG Step: Document retrieval if session has linked documents
  if (documentIds && documentIds.length > 0) {
    try {
      console.log(`[RAG] Generating query embedding for: "${userMessage.substring(0, 50)}..."`);
      const queryEmbedding = await generateQueryEmbedding(userMessage);

      console.log(`[RAG] Searching across ${documentIds.length} documents...`);
      retrievedChunks = await searchChunks(documentIds, queryEmbedding, 5);
      
      sources = retrievedChunks.map(c => ({
        documentId: c.documentId,
        documentName: c.documentName,
        similarity: c.similarity
      })).filter((v, i, a) => a.findIndex(t => t.documentId === v.documentId) === i); // dedupe by doc
      
      console.log(`[RAG] Found ${retrievedChunks.length} relevant chunks`);
    } catch (err) {
      console.error('[RAG] Retrieval failed:', err.message);
      // Continue without RAG context if retrieval fails
    }
  }

  // Build system prompt with all context layers
  const systemPrompt = buildSystemPrompt(userProfile, sessionType, sessionContext, retrievedChunks);

  // Build messages array for Groq
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // Layer 1: Add conversation history (short-term memory)
  const history = (conversationHistory || []).slice(-MAX_HISTORY);
  for (const msg of history) {
    messages.push({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: msg.message,
    });
  }

  // Add current message
  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await groq.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const { reply, metadata } = parseResponse(responseText);

    // Attach sources to metadata
    if (sources.length > 0) {
      metadata.sources = sources;
    }

    // Update session context (Layer 2)
    const updatedContext = {
      ...(sessionContext || {}),
      current_topic: metadata.topic || sessionContext?.current_topic || null,
      last_intent: metadata.intent,
      turn_count: ((sessionContext?.turn_count) || 0) + 1,
    };

    return {
      reply: reply || "I'm sorry, I couldn't generate a response. Could you try rephrasing?",
      metadata,
      updatedContext,
    };
  } catch (err) {
    console.error('LLM error:', err.message);

    // Fallback response
    return {
      reply: "I'm having trouble connecting to my AI engine right now. Please try again in a moment.",
      metadata: {
        intent: 'fallback',
        confidence: 0,
        quick_replies: ['Try again', 'Start new session'],
        topic: null,
      },
      updatedContext: sessionContext || {},
    };
  }
}

module.exports = { generateChatResponse };
