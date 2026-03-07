const Member = require('../models/Member');

// ==================== عرض الشجرة ====================
exports.getTree = async (req, res) => {
  try {
    // جلب الجذر (الجيل الأول)
    const roots = await Member.find({
      generation: 1,
      accountStatus: 'active',
    }).select('memberId fullName gender generation children profilePicture job currentCity');

    // دالة بناء الشجرة بشكل متكرر
    const buildTree = async (member, depth = 0) => {
      if (depth > 6) return member; // حد أقصى للعمق
      const children = await Member.find({
        fatherId: member._id,
        accountStatus: 'active',
      }).select('memberId fullName gender generation children profilePicture job currentCity _id');

      const enrichedChildren = await Promise.all(
        children.map(child => buildTree(child, depth + 1))
      );

      return {
        id: member._id,
        memberId: member.memberId,
        fullName: member.fullName,
        gender: member.gender,
        generation: member.generation,
        profilePicture: member.profilePicture,
        job: member.job,
        currentCity: member.currentCity,
        children: enrichedChildren,
        childrenCount: children.length,
      };
    };

    const tree = await Promise.all(roots.map(root => buildTree(root)));

    res.json({ success: true, tree });
  } catch (error) {
    console.error('getTree error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الشجرة' });
  }
};

// ==================== إضافة فرد من الذرية ====================
exports.addDescendant = async (req, res) => {
  try {
    const { fullName, gender, phoneNumber, dateOfBirth, currentCity, job } = req.body;

    if (!fullName || !gender) {
      return res.status(400).json({ success: false, message: 'الاسم والجنس مطلوبان' });
    }

    const father = req.member;

    // تحقق من الصلاحية
    if (!father.canAddDescendants && father.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'لا تملك صلاحية إضافة أفراد' });
    }

    // إنشاء العضو الجديد
    const newMember = new Member({
      fullName: fullName.trim(),
      gender,
      phoneNumber: phoneNumber || `ADDED-${Date.now()}`, // مؤقت إذا لم يكن هناك رقم
      fatherId: father._id,
      fatherMemberId: father.memberId,
      generation: (father.generation || 1) + 1,
      lineage: [...(father.lineage || []), father._id],
      accountStatus: 'active', // يُفعَّل تلقائياً
      registrationMethod: 'added_by_father',
      canAddDescendants: true,
    });

    if (dateOfBirth) newMember.dateOfBirth = new Date(dateOfBirth);
    if (currentCity) newMember.currentCity = currentCity.trim();
    if (job) newMember.job = job.trim();

    await newMember.save();

    // إضافة للأبناء عند الأب
    await Member.findByIdAndUpdate(father._id, {
      $addToSet: { children: newMember._id },
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة الفرد بنجاح',
      member: {
        id: newMember._id,
        memberId: newMember.memberId,
        fullName: newMember.fullName,
        gender: newMember.gender,
      },
    });
  } catch (error) {
    console.error('addDescendant error:', error);
    res.status(500).json({ success: false, message: 'خطأ في إضافة الفرد' });
  }
};

// ==================== البحث عن أعضاء ====================
exports.searchMembers = async (req, res) => {
  try {
    const { q, generation, gender, city } = req.query;
    const query = { accountStatus: 'active' };

    if (q) {
      query.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { memberId: { $regex: q, $options: 'i' } },
        { currentCity: { $regex: q, $options: 'i' } },
        { job: { $regex: q, $options: 'i' } },
      ];
    }
    if (generation) query.generation = Number(generation);
    if (gender) query.gender = gender;
    if (city) query.currentCity = { $regex: city, $options: 'i' };

    const members = await Member.find(query)
      .select('memberId fullName gender generation profilePicture currentCity job dateOfBirth lineage fatherId')
      .limit(50)
      .sort({ fullName: 1 });

    // بناء سلسلة الاسم لكل عضو
    const isAdmin = req.member && (req.member.role === 'admin' || req.member.role === 'superAdmin');

    const membersWithChain = await Promise.all(members.map(async (m) => {
      const obj = m.toObject();
      
      // بناء سلسلة الاسم من lineage
      let nameChain = obj.fullName;
      if (obj.lineage && obj.lineage.length > 0) {
        const ancestors = await Member.find({ _id: { $in: obj.lineage } })
          .select('fullName _id')
          .lean();
        // ترتيب الأجداد حسب lineage (الأب أولاً)
        const orderedNames = obj.lineage
          .map(id => ancestors.find(a => a._id.toString() === id.toString()))
          .filter(Boolean)
          .map(a => a.fullName);
        if (orderedNames.length > 0) {
          nameChain = obj.fullName + ' بن ' + orderedNames.reverse().join(' بن ');
        }
      }
      
      return {
        ...obj,
        nameChain,
        memberId: isAdmin || (req.member && req.member._id.toString() === obj._id.toString()) 
          ? obj.memberId 
          : undefined,
      };
    }));

    res.json({ success: true, count: membersWithChain.length, members: membersWithChain });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'خطأ في البحث' });
  }
};

// ==================== جلب بيانات عضو ====================
exports.getMember = async (req, res) => {
  try {
    const member = await Member.findOne({
      $or: [
        { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null },
        { memberId: req.params.id.toUpperCase() },
      ],
    })
      .select('-otp -fcmToken')
      .populate('fatherId', 'memberId fullName profilePicture')
      .populate('children', 'memberId fullName gender profilePicture generation');

    if (!member) {
      return res.status(404).json({ success: false, message: 'العضو غير موجود' });
    }

    // تطبيق إعدادات الخصوصية إذا كان الطلب من شخص آخر
    const isOwnProfile = req.member._id.toString() === member._id.toString();
    const isAdmin = req.member.role === 'admin' || req.member.role === 'super_admin';
    
    if (!isOwnProfile && !isAdmin) {
      const memberObj = member.toObject();
      if (member.privacy?.hidePhone) delete memberObj.phoneNumber;
      if (member.privacy?.hideJob) delete memberObj.job;
      if (member.privacy?.hideCity) delete memberObj.currentCity;
      if (member.privacy?.hideBirthDate) { delete memberObj.dateOfBirth; delete memberObj.placeOfBirth; }
      return res.json({ success: true, member: memberObj });
    }

    res.json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
};

// ==================== إحصائيات الأعضاء ====================
exports.getStats = async (req, res) => {
  try {
    const [total, active, pending, byGeneration, byGender] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ accountStatus: 'active' }),
      Member.countDocuments({ accountStatus: 'pending' }),
      Member.aggregate([
        { $match: { accountStatus: 'active' } },
        { $group: { _id: '$generation', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Member.aggregate([
        { $match: { accountStatus: 'active' } },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: { total, active, pending, byGeneration, byGender },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الإحصائيات' });
  }
};

// ==================== تحديث الخصوصية ====================
exports.updatePrivacy = async (req, res) => {
  try {
    const { hidePhone, hideJob, hideCity, hideFromTree, hideBirthDate } = req.body;
    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { privacy: { hidePhone: !!hidePhone, hideJob: !!hideJob, hideCity: !!hideCity, hideFromTree: !!hideFromTree, hideBirthDate: !!hideBirthDate } },
      { new: true }
    ).select('-otp');
    res.json({ success: true, message: 'تم تحديث إعدادات الخصوصية', member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== FCM Token ====================
exports.updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await Member.findByIdAndUpdate(req.member._id, { fcmToken });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};
