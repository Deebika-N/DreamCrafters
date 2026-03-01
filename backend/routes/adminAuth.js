const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  loginAdmin,
  logoutAdmin,
  getAdminProfile
} = require('../controllers/adminAuth');

// Public routes
router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);

// Protected routes
router.get('/profile', protect, restrictTo('admin'), getAdminProfile);

module.exports = router;
