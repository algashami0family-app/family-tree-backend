const jwt = require('jsonwebtoken');
const Member = require('../models/Member');

// التحقق من التوكن
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'غير مصرح - يرجى تسجيل الدخول' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

    const member = await Member.findById(decoded.id).select('-otp');
    if (!member) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (member.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'تم تعليق حسابك' });
    }

    req.member = member;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'رمز المصادقة غير صالح' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
    }
    next(error);
  }
};

// التحقق من صلاحية الأدمن
const adminOnly = (req, res, next) => {
  if (!req.member || !['admin', 'super_admin'].includes(req.member.role)) {
    return res.status(403).json({ success: false, message: 'غير مصرح - هذه الصفحة للمشرفين فقط' });
  }
  next();
};

// التحقق من أن الحساب مفعّل
const activeOnly = (req, res, next) => {
  if (req.member.accountStatus !== 'active') {
    return res.status(403).json({ success: false, message: 'حسابك قيد المراجعة أو لم يتم تفعيله بعد' });
  }
  next();
};

module.exports = { protect, adminOnly, activeOnly };
