const Spouse = require('../models/Spouse');
const Member = require('../models/Member');

// إضافة علاقة زوجية
exports.addSpouse = async (req, res) => {
  try {
    const { member2Id, weddingDate, divorceDate, notes } = req.body;
    const member1Id = req.user.memberId;

    // تحقق من وجود الطرفين
    const [member1, member2] = await Promise.all([
      Member.findById(member1Id),
      Member.findById(member2Id),
    ]);

    if (!member1 || !member2) {
      return res.status(404).json({ success: false, message: 'أحد الأطراف غير موجود' });
    }

    // أنشئ العلاقة (بترتيب موحّد)
    const [id1, id2] = [member1Id, member2Id].sort();
    
    const spouse = await Spouse.create({
      member1Id: id1,
      member2Id: id2,
      weddingDate,
      divorceDate,
      notes,
    });

    res.json({ success: true, spouse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'هذه العلاقة موجودة مسبقاً' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// الحصول على أزواج/زوجات فرد
exports.getSpouses = async (req, res) => {
  try {
    const { memberId } = req.params;

    const spouses = await Spouse.find({
      $or: [{ member1Id: memberId }, { member2Id: memberId }]
    }).populate('member1Id member2Id', 'fullName memberId gender currentCity profilePhoto');

    res.json({ success: true, spouses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// حذف علاقة زوجية
exports.deleteSpouse = async (req, res) => {
  try {
    const { id } = req.params;
    await Spouse.findByIdAndDelete(id);
    res.json({ success: true, message: 'تم حذف العلاقة' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// إضافة زوجة جديدة مع إنشاء حساب تلقائي
exports.addNewSpouse = async (req, res) => {
  try {
    const { spouseName, spousePhone, weddingDate, notes } = req.body;
    if (!spouseName) return res.status(400).json({ success: false, message: 'اسم الزوجة مطلوب' });

    const member1 = req.member;

    // إنشاء حساب للزوجة
    const newSpouse = new Member({
      fullName: spouseName.trim(),
      gender: 'female',
      phoneNumber: spousePhone || `SPOUSE-${Date.now()}`,
      generation: member1.generation,
      accountStatus: 'active',
      registrationMethod: 'added_by_spouse',
      canAddDescendants: false,
      privacy: {
        hideFromTree: true,
        hidePhone: true,
      },
    });

    await newSpouse.save();

    // إنشاء علاقة الزواج
    const [id1, id2] = [member1._id.toString(), newSpouse._id.toString()].sort();
    await Spouse.create({
      member1Id: id1,
      member2Id: id2,
      weddingDate: weddingDate || undefined,
      notes: notes || undefined,
    });

    res.json({
      success: true,
      message: 'تم إنشاء حساب الزوجة بنجاح',
      memberId: newSpouse.memberId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
