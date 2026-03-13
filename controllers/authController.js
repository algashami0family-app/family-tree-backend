const jwt = require('jsonwebtoken');
const Member = require('../models/Member');
const { generateOTP, sendOTP } = require('../services/smsService');
const { notifyAdminsNewRequest } = require('../services/notificationService');

// توليد JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_key', {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// تنسيق رقم الجوال
const formatPhone = (phone) => {
  let p = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (p.startsWith('05')) p = '+966' + p.slice(1);
  if (p.startsWith('5') && p.length === 9) p = '+966' + p;
  return p;
};

// ==================== إرسال OTP ====================
exports.sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'رقم الجوال مطلوب' });
    }

    const formattedPhone = formatPhone(phoneNumber);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق

    // تحديث أو إنشاء السجل
    let member = await Member.findOne({ phoneNumber: formattedPhone });
    if (member) {
      member.otp = { code: otp, expiresAt, verified: false };
      await member.save();
    } else {
      // توليد memberId يدوياً لأن pre-save لا يعمل مع upsert
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let newId;
      let exists = true;
      while (exists) {
        newId = 'FM-';
        for (let i = 0; i < 6; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
        exists = await Member.findOne({ memberId: newId });
      }
      member = new Member({
        memberId: newId,
        phoneNumber: formattedPhone,
        fullName: 'مؤقت',
        gender: 'male',
        status: 'pending',
        otp: { code: otp, expiresAt, verified: false },
      });
      await member.save();
    }

    // إرسال الرمز
    const result = await sendOTP(formattedPhone, otp);
    if (!result.success) {
      return res.status(500).json({ success: false, message: 'فشل إرسال رمز التحقق' });
    }

    res.json({
      success: true,
      message: 'تم إرسال رمز التحقق',
      dev: result.dev || false,
      otp: result.otp || undefined,
    });
  } catch (error) {
    console.error('sendOTP error:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== التحقق من OTP ====================
exports.verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, message: 'الرقم والرمز مطلوبان' });
    }

    const formattedPhone = formatPhone(phoneNumber);
    const member = await Member.findOne({ phoneNumber: formattedPhone });

    if (!member) {
      return res.status(404).json({ success: false, message: 'الرقم غير مسجل' });
    }

    if (!member.verifyOTP(otp)) {
      return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
    }

    // تحديث حالة OTP
    member.otp.verified = true;
    await member.save();

    // إذا كان الحساب مفعلاً - تسجيل الدخول مباشرة
    if (member.accountStatus === 'active') {
      member.lastLogin = new Date();
      await member.save();

      return res.json({
        success: true,
        isRegistered: true,
        token: generateToken(member._id),
        member: {
          id: member._id,
          memberId: member.memberId,
          fullName: member.fullName,
          role: member.role,
          accountStatus: member.accountStatus,
          profilePicture: member.profilePicture,
        },
      });
    }

    // إذا كان جديداً - إكمال التسجيل
    res.json({
      success: true,
      isRegistered: false,
      message: 'تم التحقق، أكمل التسجيل',
      phoneNumber: formattedPhone,
    });
  } catch (error) {
    console.error('verifyOTP error:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== التحقق من رمز الأب ====================
exports.verifyFather = async (req, res) => {
  try {
    const { fatherMemberId } = req.body;
    if (!fatherMemberId) {
      return res.status(400).json({ success: false, message: 'رمز الأب مطلوب' });
    }

    const father = await Member.findOne({
      memberId: fatherMemberId.toUpperCase(),
      accountStatus: 'active',
    }).select('memberId fullName gender canAddDescendants');

    if (!father) {
      return res.status(404).json({ success: false, message: 'رمز الأب غير صحيح أو الحساب غير مفعّل' });
    }

    res.json({
      success: true,
      father: {
        id: father._id,
        memberId: father.memberId,
        fullName: father.fullName,
        canAddDescendants: father.canAddDescendants,
      },
    });
  } catch (error) {
    console.error('verifyFather error:', error);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== إكمال التسجيل ====================
exports.completeRegistration = async (req, res) => {
  try {
    const {
      phoneNumber, fullName, gender, dateOfBirth,
      placeOfBirth, currentCity, job, fatherMemberId,
    } = req.body;

    if (!phoneNumber || !fullName || !gender) {
      return res.status(400).json({ success: false, message: 'الاسم والجنس مطلوبان' });
    }

    const formattedPhone = formatPhone(phoneNumber);
    const member = await Member.findOne({ phoneNumber: formattedPhone });

    if (!member || !member.otp?.verified) {
      return res.status(400).json({ success: false, message: 'يجب التحقق من الجوال أولاً' });
    }

    // ربط بالأب
    let father = null;
    let generation = 1;
    let lineage = [];

    if (fatherMemberId) {
      father = await Member.findOne({ memberId: fatherMemberId.toUpperCase(), accountStatus: 'active' });
      if (!father) {
        return res.status(404).json({ success: false, message: 'رمز الأب غير صحيح' });
      }
      generation = (father.generation || 1) + 1;
      lineage = [...(father.lineage || []), father._id];
    }

    // تحديث بيانات العضو
    member.fullName = fullName.trim();
    member.gender = gender;
    if (dateOfBirth) member.dateOfBirth = new Date(dateOfBirth);
    if (placeOfBirth) member.placeOfBirth = placeOfBirth.trim();
    if (currentCity) member.currentCity = currentCity.trim();
    if (job) member.job = job.trim();
    if (father) {
      member.fatherId = father._id;
      member.fatherMemberId = father.memberId;
    }
    member.generation = generation;
    member.lineage = lineage;
    member.accountStatus = 'pending';
    member.otp = undefined; // مسح OTP

    await member.save();

    // إضافة للأبناء عند الأب
    if (father) {
      await Member.findByIdAndUpdate(father._id, {
        $addToSet: { children: member._id },
      });
    }

    // إشعار الأدمن
    const admins = await Member.find({ role: { $in: ['admin', 'super_admin'] }, accountStatus: 'active' });
    if (admins.length > 0) {
      await notifyAdminsNewRequest(admins.map(a => a._id), member);
    }

    res.status(201).json({
      success: true,
      message: 'تم إرسال طلبك بنجاح، في انتظار موافقة المشرف',
      memberId: member.memberId,
    });
  } catch (error) {
    console.error('completeRegistration error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'رقم الجوال مسجل مسبقاً' });
    }
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== جلب بيانات المستخدم الحالي ====================
exports.getMe = async (req, res) => {
  try {
    const member = await Member.findById(req.member._id)
      .select('-otp')
      .populate('fatherId', 'memberId fullName')
      .populate('children', 'memberId fullName gender profilePicture');

    res.json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ==================== تحديث الملف الشخصي ====================
exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['fullName', 'currentCity', 'job', 'bio', 'email', 'profilePicture', 'fcmToken'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const member = await Member.findByIdAndUpdate(req.member._id, updates, {
      new: true, runValidators: true,
    }).select('-otp');

    res.json({ success: true, message: 'تم تحديث الملف الشخصي', member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// رفع صورة الملف الشخصي
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع صورة' });
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { profilePhoto: base64Image },
      { new: true }
    );

    res.json({ success: true, profilePhoto: base64Image, member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// رفع صورة الملف الشخصي
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع صورة' });
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { profilePhoto: base64Image },
      { new: true }
    );

    res.json({ success: true, profilePhoto: base64Image, member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
