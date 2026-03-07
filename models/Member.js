const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const memberSchema = new mongoose.Schema({
  // ==================== هوية العضو ====================
  memberId: {
    type: String,
    unique: true,
    // يُولَّد تلقائياً
  },

  fcmToken: { type: String, default: null },

  // ==================== الخصوصية ====================
  privacy: {
    hidePhone: { type: Boolean, default: false },
    hideJob: { type: Boolean, default: false },
    hideCity: { type: Boolean, default: false },
    hideFromTree: { type: Boolean, default: false },
    hideBirthDate: { type: Boolean, default: false },
  },

  // ==================== بيانات الاتصال ====================
  phoneNumber: {
    type: String,
    required: [true, 'رقم الجوال مطلوب'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
  },

  // ==================== البيانات الشخصية ====================
  fullName: {
    type: String,
    required: false,
    trim: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: false, default: 'male',
  },
  dateOfBirth: {
    type: Date,
  },
  dateOfDeath: {
    type: Date,
  },
  placeOfDeath: {
    type: String,
    trim: true,
  },
  placeOfBirth: {
    type: String,
    trim: true,
  },
  currentCity: {
    type: String,
    trim: true,
  },
  job: {
    type: String,
    trim: true,
  },
  bio: {
    type: String,
    maxlength: 500,
  },
  profilePhoto: {
    type: String, // URL or base64
  },
  profilePicture: {
    type: String, // URL للصورة
  },

  // ==================== الشجرة العائلية ====================
  fatherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    default: null,
  },
  fatherMemberId: {
    type: String, // FM-XXXXXX
    default: null,
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
  }],
  generation: {
    type: Number,
    default: 1, // الجيل الأول = الجد الأكبر
  },
  lineage: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
  }], // سلسلة الأجداد من الأقدم للأحدث

  // ==================== الحساب ====================
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'suspended'],
    default: 'pending',
  },
  role: {
    type: String,
    enum: ['member', 'admin', 'super_admin'],
    default: 'member',
  },
  canAddDescendants: {
    type: Boolean,
    default: false,
  },
  registrationMethod: {
    type: String,
    enum: ['self_registered', 'added_by_admin', 'added_by_father'],
    default: 'self_registered',
  },

  // ==================== OTP ====================
  otp: {
    code: String,
    expiresAt: Date,
    verified: { type: Boolean, default: false },
  },

  // ==================== تتبع ====================
  lastLogin: Date,
  fcmToken: String, // للإشعارات

}, { timestamps: true });

// ==================== Hooks ====================

// توليد Member ID تلقائياً
memberSchema.pre('save', async function (next) {
  if (!this.memberId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id;
    let exists = true;
    while (exists) {
      id = 'FM-';
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      exists = await mongoose.model('Member').findOne({ memberId: id });
    }
    this.memberId = id;
  }
  next();
});

// ==================== Methods ====================

// التحقق من صحة OTP
memberSchema.methods.verifyOTP = function (code) {
  if (!this.otp || !this.otp.code) return false;
  if (new Date() > this.otp.expiresAt) return false;
  return this.otp.code === code;
};

// ==================== Virtuals ====================
memberSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

memberSchema.set('toJSON', { virtuals: true });
memberSchema.set('toObject', { virtuals: true });

// ==================== Indexes ====================
memberSchema.index({ memberId: 1 });
memberSchema.index({ phoneNumber: 1 });
memberSchema.index({ fatherId: 1 });
memberSchema.index({ accountStatus: 1 });

module.exports = mongoose.model('Member', memberSchema);
