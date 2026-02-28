const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, default: 'شجرة العائلة' },
  data: { type: String }, // base64
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  updatedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('FamilyTreePdf', schema);
