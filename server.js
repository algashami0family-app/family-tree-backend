const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const adminRoutes = require('./routes/adminRoutes');
const newsRoutes = require('./routes/newsRoutes');
const spouseRoutes = require('./routes/spouseRoutes');
const familyTreeRoutes = require('./routes/familyTreeRoutes');
const treePdfRoutes = require('./routes/treePdf');

const app = express();

// ==================== Middleware ====================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100,
  message: { success: false, message: 'طلبات كثيرة جداً، حاول بعد قليل' }
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 3,
  message: { success: false, message: 'تجاوزت الحد المسموح لإرسال OTP' }
});

app.use('/api/', limiter);
app.use('/api/auth/send-otp', otpLimiter);

// ==================== Database ====================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/family-tree')
  .then(() => console.log('✅ MongoDB متصل'))
  .catch(err => console.error('❌ MongoDB خطأ:', err));

// ==================== Routes ====================
app.use('/api/auth', authRoutes);
app.use('/api/tree-pdf', treePdfRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/spouses', spouseRoutes);
app.use('/api/family-tree', familyTreeRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'السيرفر يعمل بشكل صحيح ✅', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ خطأ:', err.stack);
  res.status(500).json({ success: false, message: 'خطأ في السيرفر', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ==================== Start ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`📡 http://localhost:${PORT}/api/health`);
});
