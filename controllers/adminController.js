const { sendNewsNotification } = require('../utils/notifications');
const Member = require('../models/Member');
const News = require('../models/News');
const Notification = require('../models/Notification');
const { notifyRequestApproved, notifyRequestRejected } = require('../services/notificationService');

// ==================== طلبات الانضمام ====================
exports.getJoinRequests = async (req, res) => {
  try {
    const requests = await Member.find({ accountStatus: 'pending' })
      .populate('fatherId', 'memberId fullName')
      .select('-otp -fcmToken')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الطلبات' });
  }
};

// ==================== قبول طلب ====================
exports.approveRequest = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'العضو غير موجود' });
    }

    if (member.accountStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'الطلب غير معلق' });
    }

    member.accountStatus = 'active';
    member.canAddDescendants = true;
    await member.save();

    // إشعار العضو
    await notifyRequestApproved(member._id);

    res.json({ success: true, message: `تم قبول ${member.fullName} في العائلة 🎉` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في قبول الطلب' });
  }
};

// ==================== رفض طلب ====================
exports.rejectRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'العضو غير موجود' });
    }

    member.accountStatus = 'rejected';
    await member.save();

    await notifyRequestRejected(member._id, reason);

    res.json({ success: true, message: 'تم رفض الطلب' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في رفض الطلب' });
  }
};

// ==================== الإحصائيات ====================
exports.getStatistics = async (req, res) => {
  try {
    const [
      totalMembers, activeMembers, pendingMembers, rejectedMembers,
      maleCount, femaleCount, generationsData, totalNews,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ accountStatus: 'active' }),
      Member.countDocuments({ accountStatus: 'pending' }),
      Member.countDocuments({ accountStatus: 'rejected' }),
      Member.countDocuments({ gender: 'male', accountStatus: 'active' }),
      Member.countDocuments({ gender: 'female', accountStatus: 'active' }),
      Member.aggregate([
        { $match: { accountStatus: 'active' } },
        { $group: { _id: '$generation', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      News.countDocuments({ isPublished: true }),
    ]);

    // أحدث الأعضاء
    const recentMembers = await Member.find({ accountStatus: 'active' })
      .select('fullName memberId gender generation createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        members: { total: totalMembers, active: activeMembers, pending: pendingMembers, rejected: rejectedMembers },
        gender: { male: maleCount, female: femaleCount },
        generations: generationsData,
        content: { news: totalNews },
        recentMembers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات' });
  }
};

// ==================== إدارة الأعضاء ====================
exports.getAllMembers = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.accountStatus = status;

    const members = await Member.find(query)
      .select('-otp -fcmToken')
      .populate('fatherId', 'memberId fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Member.countDocuments(query);

    res.json({
      success: true,
      members,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الأعضاء' });
  }
};

// ==================== تغيير دور عضو ====================
exports.updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'الدور غير صالح' });
    }

    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-otp');

    if (!member) {
      return res.status(404).json({ success: false, message: 'العضو غير موجود' });
    }

    res.json({ success: true, message: 'تم تحديث الدور', member });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في التحديث' });
  }
};

// ==================== نشر خبر ====================
exports.createNews = async (req, res) => {
  try {
    const { title, content, type, image, images, eventDate, eventLocation, isPinned } = req.body;
    console.log('IMAGES COUNT:', Array.isArray(images) ? images.length : 'NOT ARRAY', typeof images);
    console.log('NEWS CREATE - image:', image ? image.substring(0,30) : 'NULL', '| keys:', Object.keys(req.body));
    console.log('IMAGE RECEIVED:', image ? image.substring(0,50) : 'NULL');

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'العنوان والمحتوى مطلوبان' });
    }

    const imagesArr = Array.isArray(images) ? images : (image ? [image] : []);
    const news = await News.create({
      title: title.trim(),
      content: content.trim(),
      type: type || 'announcement',
      image: imagesArr[0] || null,
      images: imagesArr,
      author: req.member._id,
      eventDate: eventDate ? new Date(eventDate) : undefined,
      eventLocation,
      isPinned: isPinned || false,
    });

    sendNewsNotification('خبر جديد 📢', title, news._id).catch(() => {});
    res.status(201).json({ success: true, message: 'تم نشر الخبر', news });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في نشر الخبر' });
  }
};

// ==================== تهيئة أدمن أول ====================
exports.initAdmin = async (req, res) => {
  try {
    const existingAdmin = await Member.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'يوجد أدمن بالفعل' });
    }

    const admin = await Member.create({
      phoneNumber: process.env.ADMIN_PHONE || '+966500000000',
      fullName: process.env.ADMIN_NAME || 'مدير النظام',
      gender: 'male',
      generation: 1,
      accountStatus: 'active',
      role: 'admin',
      canAddDescendants: true,
      registrationMethod: 'added_by_admin',
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب الأدمن',
      admin: { memberId: admin.memberId, phoneNumber: admin.phoneNumber },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إنشاء الأدمن' });
  }
};

// ==================== قائمة الأعضاء ====================
exports.getMembers = async (req, res) => {
  try {
    const Member = require('../models/Member');
    const members = await Member.find()
      .select('fullName memberId phoneNumber gender accountStatus role generation privacy registrationMethod fatherId createdAt')
      .sort({ createdAt: -1 });

    // نجيب أسماء الآباء والمضيفين
    const memberIds = members.map(m => m._id);
    const fatherIds = members.filter(m => m.fatherId).map(m => m.fatherId);
    const fathers = await Member.find({ _id: { $in: fatherIds } }).select('_id fullName memberId');
    const fatherMap = {};
    fathers.forEach(f => { fatherMap[f._id.toString()] = f.fullName; });

    // نجيب معلومات الزوجات
    const Spouse = require('../models/Spouse');
    const spouseObjectIds = members.filter(m => m.registrationMethod === 'added_by_spouse').map(m => m._id);
    const spouseLinks = await Spouse.find({ $or: [{ member1Id: { $in: spouseObjectIds } }, { member2Id: { $in: spouseObjectIds } }] });

    const allSpouseMemberIds = [...new Set(spouseLinks.flatMap(s => [s.member1Id?.toString(), s.member2Id?.toString()]).filter(Boolean))];
    const spouseMembers2 = await Member.find({ _id: { $in: allSpouseMemberIds } }).select('_id fullName');
    const memberNameMap = {};
    spouseMembers2.forEach(m => { memberNameMap[m._id.toString()] = m.fullName; });

    const spouseMap = {};
    spouseLinks.forEach(s => {
      const m1 = s.member1Id?.toString();
      const m2 = s.member2Id?.toString();
      if (m1 && m2) {
        spouseMap[m1] = memberNameMap[m2] || '';
        spouseMap[m2] = memberNameMap[m1] || '';
      }
    });

    const result = members.map(m => {
      const obj = m.toObject();
      if (m.fatherId) obj.fatherName = fatherMap[m.fatherId.toString()] || '';
      if (m.registrationMethod === 'added_by_spouse') {
        obj.spouseOfName = spouseMap[m._id.toString()] || '';
      }
      return obj;
    });

    res.json({ success: true, members: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الأعضاء' });
  }
};

// ==================== حذف عضو ====================
exports.deleteMember = async (req, res) => {
  try {
    const Member = require('../models/Member');
    const { id } = req.params;
    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ success: false, message: 'العضو غير موجود' });
    if (member.role === 'super_admin') return res.status(403).json({ success: false, message: 'لا يمكن حذف المشرف الرئيسي' });
    // إزالة من قائمة أبناء الأب
    if (member.fatherId) {
      await Member.findByIdAndUpdate(member.fatherId, { $pull: { children: member._id } });
    }
    await Member.findByIdAndDelete(id);
    res.json({ success: true, message: 'تم حذف العضو بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف العضو' });
  }
};
