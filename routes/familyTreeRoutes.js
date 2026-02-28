const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { uploadFamilyTree, getFamilyTree } = require('../controllers/familyTreeController');

router.get('/', protect, getFamilyTree);
router.post('/upload', protect, adminOnly, uploadFamilyTree);

module.exports = router;
