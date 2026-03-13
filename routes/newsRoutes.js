const express = require('express');
const router = express.Router();
const { getAllNews, getNewsById, deleteNews, updateNews, createNews, getNewsStats } = require('../controllers/newsController');
const { protect, adminOnly, activeOnly } = require('../middleware/auth');

router.use(protect, activeOnly);

router.get('/', getAllNews);
router.get('/:id', getNewsById);
router.post('/', adminOnly, createNews);
router.put('/:id', adminOnly, updateNews);
router.delete('/:id', adminOnly, deleteNews);

module.exports = router;
