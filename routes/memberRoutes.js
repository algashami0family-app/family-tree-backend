const express = require('express');
const router = express.Router();
const {
  getTree, addDescendant, searchMembers, getMember, getStats,
  updatePrivacy,
} = require('../controllers/memberController');
const { protect, activeOnly } = require('../middleware/auth');

router.use(protect);

router.get('/tree', activeOnly, getTree);
router.get('/search', activeOnly, searchMembers);
router.get('/stats', activeOnly, getStats);
router.get('/:id', activeOnly, getMember);
router.post('/add-descendant', activeOnly, addDescendant);
router.put('/privacy', activeOnly, updatePrivacy);

module.exports = router;
