const mongoose = require('mongoose');

const biographySchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: false,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    default: '',
  },
  images: [{
    type: String,
  }],
  dateOfBirth: {
    type: Date,
  },
  dateOfDeath: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
  },
}, { timestamps: true });

module.exports = mongoose.model('Biography', biographySchema);
