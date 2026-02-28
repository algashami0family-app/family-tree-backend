const express = require('express');
const router = express.Router();
const {
  getJoinRequests, approveRequest, rejectRequest,
  getStatistics, getAllMembers, updateMemberRole,
  createNews, initAdmin,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// تهيئة الأدمن الأول (بدون مصادقة - مرة واحدة فقط)
router.post('/init', initAdmin);

// محمي للأدمن فقط
router.use(protect, adminOnly);

router.get('/join-requests', getJoinRequests);
router.post('/approve/:id', approveRequest);
router.post('/reject/:id', rejectRequest);
router.get('/statistics', getStatistics);
router.get('/members', getAllMembers);
router.put('/members/:id/role', updateMemberRole);
router.post('/news', createNews);

module.exports = router;
