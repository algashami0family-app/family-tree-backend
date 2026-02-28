const express = require('express');
const router = express.Router();
const { getAllNews, getNewsById, deleteNews, updateNews, getNewsStats } = require('../controllers/newsController');
const { protect, adminOnly, activeOnly } = require('../middleware/auth');

router.use(protect, activeOnly);

router.get('/', getAllNews);
router.get('/:id', getNewsById);
router.delete('/:id', adminOnly, deleteNews);

module.exports = router;
