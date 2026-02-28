const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الخبر مطلوب'],
    trim: true,
    maxlength: 200,
  },
  content: {
    type: String,
    required: [true, 'محتوى الخبر مطلوب'],
  },
  type: {
    type: String,
    enum: ['announcement', 'event', 'obituary', 'wedding', 'birth', 'achievement', 'other'],
    default: 'announcement',
  },
  image: {
    type: String,
  },
  images: {
    type: [String],
    default: [],
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  views: {
    type: Number,
    default: 0,
  },
  eventDate: {
    type: Date, // للمناسبات
  },
  eventLocation: {
    type: String,
  },
}, { timestamps: true });

newsSchema.index({ isPublished: 1, createdAt: -1 });
newsSchema.index({ isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('News', newsSchema);
