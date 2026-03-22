const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createSession,
  listSessions,
  getMessages,
  sendMessage,
  endSession,
  deleteSession,
} = require('../controllers/chatController');

// All chat routes require authentication
router.use(protect);

// Chat Sessions
router.post('/sessions', createSession);
router.get('/sessions', listSessions);

// Chat Messages (must come before /:id routes)
router.get('/sessions/:id/messages', getMessages);
router.post('/sessions/:id/messages', sendMessage);

// Session management
router.patch('/sessions/:id/end', endSession);
router.delete('/sessions/:id', deleteSession);

module.exports = router;
