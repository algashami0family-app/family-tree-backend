const express = require('express');
const router = express.Router();
const {
  getTree, addDescendant, searchMembers, getMember, getStats,
  updatePrivacy, updateFcmToken, getMyDescendants,
  updateProfile, uploadProfilePhoto,
} = require('../controllers/memberController');
const { protect, activeOnly } = require('../middleware/auth');

router.use(protect);

router.get('/tree', activeOnly, getTree);
router.get('/search', activeOnly, searchMembers);
router.get('/stats', activeOnly, getStats);
router.get('/my-descendants', activeOnly, getMyDescendants);
router.get('/:id', activeOnly, getMember);
router.post('/add-descendant', activeOnly, addDescendant);
router.put('/privacy', activeOnly, updatePrivacy);
router.put('/fcm-token', updateFcmToken);
router.put('/profile', activeOnly, updateProfile);
router.put('/profile/photo', activeOnly, uploadProfilePhoto);

module.exports = router;
