const express = require('express');
const router = express.Router();
const { protect, activeOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  sendOTP,
  verifyOTP,
  verifyFather,
  completeRegistration,
  getMe,
  updateProfile,
  uploadProfilePhoto,
} = require('../controllers/authController');

// Auth routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/verify-father', protect, verifyFather);
router.post('/complete-registration', protect, completeRegistration);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.post('/upload-photo', protect, upload.single('photo'), uploadProfilePhoto);

module.exports = router;
