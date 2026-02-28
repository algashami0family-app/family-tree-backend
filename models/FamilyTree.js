const mongoose = require('mongoose');

const familyTreeSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'شجرة العائلة',
  },
  imageUrl: {
    type: String, // base64 or URL
  },
  pdfUrl: {
    type: String,
  },
  description: {
    type: String,
    maxlength: 1000,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('FamilyTree', familyTreeSchema);
