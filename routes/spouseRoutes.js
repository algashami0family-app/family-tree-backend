const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { addSpouse, getSpouses, deleteSpouse } = require('../controllers/spouseController');

router.post('/', protect, addSpouse);
router.get('/:memberId', protect, getSpouses);
router.delete('/:id', protect, deleteSpouse);

module.exports = router;
