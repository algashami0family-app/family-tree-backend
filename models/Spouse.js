const mongoose = require('mongoose');

const spouseSchema = new mongoose.Schema({
  member1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
  },
  member2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
  },
  weddingDate: {
    type: Date,
  },
  divorceDate: {
    type: Date,
  },
  notes: {
    type: String,
    maxlength: 500,
  },
}, { timestamps: true });

// منع تكرار نفس العلاقة
spouseSchema.index({ member1Id: 1, member2Id: 1 }, { unique: true });

module.exports = mongoose.model('Spouse', spouseSchema);
