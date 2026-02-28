const FamilyTree = require('../models/FamilyTree');

// رفع صورة/PDF الشجرة (Admin فقط)
exports.uploadFamilyTree = async (req, res) => {
  try {
    const { title, description, image, pdf } = req.body;

    // احذف القديم
    await FamilyTree.deleteMany({});

    // أنشئ جديد
    const tree = await FamilyTree.create({
      title: title || 'شجرة العائلة',
      description,
      imageUrl: image,
      pdfUrl: pdf,
      uploadedBy: req.user.memberId,
    });

    res.json({ success: true, tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// الحصول على الشجرة الحالية
exports.getFamilyTree = async (req, res) => {
  try {
    const tree = await FamilyTree.findOne().populate('uploadedBy', 'fullName memberId');
    res.json({ success: true, tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
