const express = require('express');
const router = express.Router();
const { getBiographies, getBiography, createBiography, updateBiography, deleteBiography } = require('../controllers/biographyController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getBiographies);
router.get('/:id', protect, getBiography);
router.post('/', protect, adminOnly, createBiography);
router.put('/:id', protect, adminOnly, updateBiography);
router.delete('/:id', protect, adminOnly, deleteBiography);

module.exports = router;
