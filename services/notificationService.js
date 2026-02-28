const Notification = require('../models/Notification');

// إنشاء إشعار في قاعدة البيانات
const createNotification = async ({ recipient, type, title, body, data }) => {
  try {
    const notification = await Notification.create({ recipient, type, title, body, data });
    // يمكن إضافة Firebase Push هنا لاحقاً
    return notification;
  } catch (error) {
    console.error('❌ خطأ في إنشاء الإشعار:', error.message);
  }
};

// إشعار: طلب انضمام جديد (للأدمن)
const notifyAdminsNewRequest = async (adminIds, newMember) => {
  for (const adminId of adminIds) {
    await createNotification({
      recipient: adminId,
      type: 'join_request_received',
      title: 'طلب انضمام جديد',
      body: `${newMember.fullName} يطلب الانضمام للعائلة`,
      data: { memberId: newMember._id },
    });
  }
};

// إشعار: قبول الطلب
const notifyRequestApproved = async (memberId) => {
  await createNotification({
    recipient: memberId,
    type: 'join_request_approved',
    title: 'تم قبول طلبك 🎉',
    body: 'مرحباً بك في عائلتنا! يمكنك الآن استخدام التطبيق.',
  });
};

// إشعار: رفض الطلب
const notifyRequestRejected = async (memberId, reason) => {
  await createNotification({
    recipient: memberId,
    type: 'join_request_rejected',
    title: 'تم رفض طلبك',
    body: reason || 'للأسف لم يتم قبول طلبك. للمزيد تواصل مع المشرف.',
  });
};

module.exports = {
  createNotification,
  notifyAdminsNewRequest,
  notifyRequestApproved,
  notifyRequestRejected,
};
