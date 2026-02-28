const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const FamilyTreePdf = require('../models/FamilyTreePdf');

router.post('/upload', auth, async (req, res) => {
  try {
    const { data, title } = req.body;
    if (!data) return res.status(400).json({ success: false, message: 'الملف مطلوب' });
    await FamilyTreePdf.findOneAndUpdate(
      {},
      { data, title: title || 'شجرة العائلة', uploadedBy: req.member._id, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ success: true, message: 'تم رفع الملف' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'خطأ في الرفع' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const pdf = await FamilyTreePdf.findOne().lean();
    res.json({ success: true, pdf });
  } catch (e) {
    res.status(500).json({ success: false, message: 'خطأ' });
  }
});

module.exports = router;
