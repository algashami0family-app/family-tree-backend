const express = require('express');
const router = express.Router();
const { getMyDescendants,
  getTree, addDescendant, searchMembers, getMember, getStats,
  updatePrivacy,
  updateFcmToken,
} = require('../controllers/memberController');
const { getMyDescendants, protect, activeOnly } = require('../middleware/auth');

router.use(protect);

router.get('/tree', activeOnly, getTree);
router.get('/search', activeOnly, searchMembers);
router.get('/stats', activeOnly, getStats);
router.get('/:id', activeOnly, getMember);
router.post('/add-descendant', activeOnly, addDescendant);
router.put('/privacy', activeOnly, updatePrivacy);
router.put('/fcm-token', updateFcmToken);

module.exports = router;
router.get('/my-descendants', protect, getMyDescendants);
