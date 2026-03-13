const { uploadBase64 } = require('../utils/cloudinary');
const Biography = require('../models/Biography');
const Member = require('../models/Member');

// جلب كل السِّيَر
exports.getBiographies = async (req, res) => {
  try {
    const bios = await Biography.find()
      .populate('memberId', 'fullName memberId generation profilePicture')
      .sort({ createdAt: -1 });
    res.json({ success: true, biographies: bios });
  } catch (e) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السِّيَر' });
  }
};

// جلب سيرة واحدة
exports.getBiography = async (req, res) => {
  try {
    const bio = await Biography.findById(req.params.id)
      .populate('memberId', 'fullName memberId generation profilePicture');
    if (!bio) return res.status(404).json({ success: false, message: 'السيرة غير موجودة' });
    res.json({ success: true, biography: bio });
  } catch (e) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السيرة' });
  }
};

// إضافة سيرة (أدمن فقط)
exports.createBiography = async (req, res) => {
  try {
    const { memberId, title, content, images, dateOfBirth, dateOfDeath } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'العنوان مطلوب' });
    let memberObjectId = null;
    if (memberId) {
      const member = await Member.findById(memberId);
      if (!member) return res.status(404).json({ success: false, message: 'العضو غير موجود' });
      memberObjectId = member._id;
    }
    // رفع الصور لـ Cloudinary
    let imageUrls = [];
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.startsWith('data:') || img.startsWith('http')) {
          if (img.startsWith('data:')) {
            const url = await uploadBase64(img);
            imageUrls.push(url);
          } else {
            imageUrls.push(img);
          }
        }
      }
    }
    const bio = await Biography.create({
      memberId: memberObjectId, title, content, images: imageUrls,
      dateOfBirth, dateOfDeath, createdBy: req.member._id,
    });
    res.json({ success: true, biography: bio });
  } catch (e) {
    console.error('BIO CREATE ERROR:', e.message, e.stack);
    res.status(500).json({ success: false, message: e.message });
  }
};

// تعديل سيرة (أدمن فقط)
exports.updateBiography = async (req, res) => {
  try {
    const { title, content, images, dateOfBirth, dateOfDeath, memberId } = req.body;
    let memberObjectId = undefined;
    if (memberId) {
      const member = await Member.findById(memberId);
      memberObjectId = member ? member._id : undefined;
    }
    let imageUrls2 = [];
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.startsWith('data:')) {
          const url = await uploadBase64(img);
          imageUrls2.push(url);
        } else {
          imageUrls2.push(img);
        }
      }
    }
    const updateData = { title, content, images: imageUrls2, dateOfBirth, dateOfDeath };
    if (memberObjectId !== undefined) updateData.memberId = memberObjectId;
    const bio = await Biography.findByIdAndUpdate(
      req.params.id, updateData, { new: true }
    ).populate('memberId', 'fullName memberId generation profilePicture');
    if (!bio) return res.status(404).json({ success: false, message: 'السيرة غير موجودة' });
    res.json({ success: true, biography: bio });
  } catch (e) {
    res.status(500).json({ success: false, message: 'خطأ في تعديل السيرة' });
  }
};

// حذف سيرة (أدمن فقط)
exports.deleteBiography = async (req, res) => {
  try {
    await Biography.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم حذف السيرة' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'خطأ في حذف السيرة' });
  }
};
