const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'join_request_received',    // طلب انضمام جديد (للأدمن)
      'join_request_approved',    // تم قبول طلبك
      'join_request_rejected',    // تم رفض طلبك
      'descendant_added',         // تم إضافة فرد من ذريتك
      'new_news',                 // خبر جديد
      'general',                  // عام
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed, // بيانات إضافية
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
