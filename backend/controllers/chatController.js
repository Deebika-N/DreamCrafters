const prisma = require('../lib/prisma');
const { generateChatResponse } = require('../lib/llmService');

// ─── Helpers ──────────────────────────────────────────────

const VALID_SESSION_TYPES = ['general', 'career', 'study', 'navigation', 'rag'];

/** Verify session exists and belongs to user */
async function getSessionOrFail(sessionId, userId) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: { status: 404, message: 'Chat session not found' } };
  if (session.userId !== userId) return { error: { status: 403, message: 'Access denied' } };
  return { session };
}

// ─── POST /api/chat/sessions ──────────────────────────────
exports.createSession = async (req, res) => {
  try {
    const { session_type, document_ids } = req.body;
    const sessionType = session_type || 'general';

    if (!VALID_SESSION_TYPES.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid session_type. Must be one of: ${VALID_SESSION_TYPES.join(', ')}`,
      });
    }

    const session = await prisma.chatSession.create({
      data: {
        userId: req.user.id,
        sessionType,
        context: {},
      },
    });

    // If documents are provided, link them to the session
    if (sessionType === 'rag' && Array.isArray(document_ids) && document_ids.length > 0) {
      const links = document_ids.map(docId => ({
        sessionId: session.id,
        documentId: parseInt(docId, 10),
      }));

      await prisma.chatSessionDocument.createMany({
        data: links,
        skipDuplicates: true,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        session_id: session.id,
        session_type: session.sessionType,
        started_at: session.startedAt,
        ended_at: session.endedAt,
      },
    });
  } catch (err) {
    console.error('createSession error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── GET /api/chat/sessions ───────────────────────────────
exports.listSessions = async (req, res) => {
  try {
    const where = { userId: req.user.id };

    // Filter by session_type
    if (req.query.session_type && VALID_SESSION_TYPES.includes(req.query.session_type)) {
      where.sessionType = req.query.session_type;
    }

    // Filter active-only
    if (req.query.active === 'true') {
      where.endedAt = null;
    }

    const sessions = await prisma.chatSession.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { message: true, createdAt: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const data = sessions.map(s => ({
      session_id: s.id,
      session_type: s.sessionType,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      message_count: s._count.messages,
      last_message_preview: s.messages[0]?.message?.substring(0, 100) || null,
      last_message_at: s.messages[0]?.createdAt || null,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('listSessions error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── GET /api/chat/sessions/:id/messages ──────────────────
exports.getMessages = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    const { session, error } = await getSessionOrFail(sessionId, req.user.id);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        message: true,
        metadata: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── POST /api/chat/sessions/:id/messages ─────────────────
exports.sendMessage = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message must be under 2000 characters' });
    }

    // Verify session ownership and status
    const { session, error } = await getSessionOrFail(sessionId, req.user.id);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    if (session.endedAt) {
      return res.status(400).json({
        success: false,
        error: 'This session has ended. Start a new session.',
      });
    }

    // Dynamic RAG: Update linked documents if provided in the body
    const { document_ids } = req.body;
    if (Array.isArray(document_ids)) {
      // Clear existing links and add new ones
      await prisma.chatSessionDocument.deleteMany({
        where: { sessionId }
      });
      
      if (document_ids.length > 0) {
        const links = document_ids.map(docId => ({
          sessionId,
          documentId: parseInt(docId, 10),
        }));
        await prisma.chatSessionDocument.createMany({
          data: links,
          skipDuplicates: true,
        });

        // Ensure session type is 'rag' if docs are attached
        if (session.sessionType !== 'rag') {
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: { sessionType: 'rag' }
          });
          session.sessionType = 'rag';
        }
      }
    }

    // Save user message
    const userMsg = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        message: message.trim(),
      },
    });

    // Fetch conversation history (Layer 1)
    const history = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, message: true },
    });

    // Fetch linked documents for RAG (if any)
    const linkedDocs = await prisma.chatSessionDocument.findMany({
      where: { sessionId },
      select: { documentId: true },
    });
    const documentIds = linkedDocs.map(ld => ld.documentId);

    // Generate bot reply via LLM with all 3 memory layers + RAG
    const { reply, metadata, updatedContext } = await generateChatResponse({
      userMessage: message.trim(),
      userId: req.user.id,
      sessionType: session.sessionType,
      sessionContext: session.context,
      conversationHistory: history.slice(0, -1), // exclude the just-saved user message
      documentIds,
    });

    // Save bot reply
    const botMsg = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'bot',
        message: reply,
        metadata,
      },
    });

    // Update session context (Layer 2)
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { context: updatedContext },
    });

    return res.status(200).json({
      success: true,
      data: {
        userMessage: {
          id: userMsg.id,
          role: 'user',
          message: userMsg.message,
          created_at: userMsg.createdAt,
        },
        botReply: {
          id: botMsg.id,
          role: 'bot',
          message: botMsg.message,
          metadata: botMsg.metadata,
          created_at: botMsg.createdAt,
        },
      },
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── PATCH /api/chat/sessions/:id/end ─────────────────────
exports.endSession = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    const { session, error } = await getSessionOrFail(sessionId, req.user.id);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    if (session.endedAt) {
      return res.status(400).json({ success: false, error: 'Session is already ended' });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      data: {
        session_id: updated.id,
        ended_at: updated.endedAt,
        message: 'Chat session ended',
      },
    });
  } catch (err) {
    console.error('endSession error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── DELETE /api/chat/sessions/:id ────────────────────────
exports.deleteSession = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID' });
    }

    const { session, error } = await getSessionOrFail(sessionId, req.user.id);
    if (error) return res.status(error.status).json({ success: false, error: error.message });

    await prisma.chatSession.delete({ where: { id: sessionId } });

    return res.status(200).json({
      success: true,
      data: { message: 'Chat session deleted' },
    });
  } catch (err) {
    console.error('deleteSession error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
