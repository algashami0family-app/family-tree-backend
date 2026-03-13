const Member = require('../models/Member');

// ==================== عرض الشجرة ====================
exports.getTree = async (req, res) => {
  try {
    // جلب الجذر (الجيل الأول)
    const roots = await Member.find({
      generation: 1,
      accountStatus: 'active',
      'privacy.hideFromTree': { $ne: true },
    }).select('memberId fullName gender generation children profilePicture job currentCity');

    // دالة بناء الشجرة بشكل متكرر
    const buildTree = async (member, depth = 0, parentChain = null) => {
      if (depth > 6) return member; // حد أقصى للعمق
      const children = await Member.find({
        fatherId: member._id,
        accountStatus: 'active',
      }).select('memberId fullName gender generation children profilePicture job currentCity _id');

      const enrichedChildren = await Promise.all(
        children.map(child => buildTree(child, depth + 1, parentChain ? `${member.fullName} بن ${parentChain}` : member.fullName))
      );

      return {
        id: member._id,
        memberId: member.memberId,
        fullName: member.fullName,
        fullNameChain: parentChain ? `${member.fullName} بن ${parentChain}` : member.fullName,
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
    const { fullName, gender, phoneNumber, dateOfBirth, currentCity, job, hideFromTree } = req.body;

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
    if (hideFromTree) newMember.privacy = { ...newMember.privacy, hideFromTree: true };

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
      // نقسم الاستعلام للبحث في أجزاء الاسم منفصلة
      const nameParts = q.trim().split(/\s+(?:بن|بنت|bin|bint)?\s*/i).filter(Boolean);
      const nameConditions = nameParts.map(part => ({
        fullName: { $regex: part, $options: 'i' }
      }));
      query.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { memberId: { $regex: q, $options: 'i' } },
        { currentCity: { $regex: q, $options: 'i' } },
        { job: { $regex: q, $options: 'i' } },
        ...(nameConditions.length > 1 ? [{ $and: nameConditions }] : []),
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

    // بناء سلسلة الاسم الكامل
    const memberObj = member.toObject();
    let nameChain = memberObj.fullName;
    if (memberObj.lineage && memberObj.lineage.length > 0) {
      const ancestors = await Member.find({ _id: { $in: memberObj.lineage } })
        .select('fullName _id').lean();
      const orderedNames = memberObj.lineage
        .map(id => ancestors.find(a => a._id.toString() === id.toString()))
        .filter(Boolean).map(a => a.fullName);
      if (orderedNames.length > 0) {
        nameChain = memberObj.fullName + ' بن ' + orderedNames.reverse().join(' بن ');
      }
    }
    memberObj.nameChain = nameChain;

    res.json({ success: true, member: memberObj });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
  }
};

// ==================== إحصائيات الأعضاء ====================
exports.getStats = async (req, res) => {
  try {
    const noSpouse = { registrationMethod: { $ne: 'added_by_spouse' } };
    const [total, active, pending, byGeneration, byGender] = await Promise.all([
      Member.countDocuments(noSpouse),
      Member.countDocuments({ accountStatus: 'active', ...noSpouse }),
      Member.countDocuments({ accountStatus: 'pending', ...noSpouse }),
      Member.aggregate([
        { $match: { accountStatus: 'active', registrationMethod: { $ne: 'added_by_spouse' } } },
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

// ==================== ذرية العضو الحالي ====================
exports.getMyDescendants = async (req, res) => {
  try {
    const member = req.member;
    // نجيب كل الأعضاء اللي lineage يحتوي على id العضو الحالي
    const descendants = await Member.find({
      lineage: { $in: [member._id] },
      accountStatus: { $ne: 'rejected' },
    }).select('fullName memberId gender generation currentCity job phoneNumber privacy accountStatus');
    res.json({ success: true, members: descendants });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الذرية' });
  }
};

// ==================== تحديث الملف الشخصي ====================
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, currentCity, job, dateOfDeath, placeOfDeath } = req.body;
    const updates = {};
    if (fullName) updates.fullName = fullName.trim();
    if (currentCity !== undefined) updates.currentCity = currentCity;
    if (job !== undefined) updates.job = job;
    if (dateOfDeath !== undefined) updates.dateOfDeath = dateOfDeath;
    if (placeOfDeath !== undefined) updates.placeOfDeath = placeOfDeath;

    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { $set: updates },
      { new: true }
    );
    res.json({ success: true, member });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الملف' });
  }
};

// ==================== رفع الصورة الشخصية ====================
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ success: false, message: 'الصورة مطلوبة' });

    const cloudinary = require('../utils/cloudinary');
    const result = await cloudinary.uploader.upload(photo, {
      folder: 'family-tree/profiles',
      transformation: [{ width: 400, height: 400, crop: 'fill' }],
    });

    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { $set: { profilePhoto: result.secure_url } },
      { new: true }
    );
    res.json({ success: true, profilePhoto: result.secure_url, member });
  } catch (error) {
    console.error('uploadProfilePhoto error:', error);
    res.status(500).json({ success: false, message: 'خطأ في رفع الصورة' });
  }
};
