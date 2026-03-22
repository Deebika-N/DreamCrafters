const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  getDocumentStatus,
} = require('../controllers/ragController');

// All RAG routes require authentication
router.use(protect);

// Document management
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', listDocuments);
router.get('/documents/:id', getDocument);
router.get('/documents/:id/status', getDocumentStatus);
router.delete('/documents/:id', deleteDocument);

module.exports = router;
