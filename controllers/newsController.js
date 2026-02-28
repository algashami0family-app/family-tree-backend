const News = require('../models/News');
const Member = require('../models/Member');

// الحصول على كل الأخبار
exports.getAllNews = async (req, res) => {
  try {
    const news = await News.find()
      .populate('author', 'fullName memberId')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50);

    res.json({ success: true, news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// الحصول على خبر واحد
exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'fullName memberId');

    if (!news) {
      return res.status(404).json({ success: false, message: 'الخبر غير موجود' });
    }

    res.json({ success: true, news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// حذف خبر (أدمن فقط)
exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'الخبر غير موجود' });
    }

    res.json({ success: true, message: 'تم حذف الخبر' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// تعديل خبر (أدمن فقط)
exports.updateNews = async (req, res) => {
  try {
    const { title, content, type, isPinned } = req.body;
    
    const news = await News.findByIdAndUpdate(
      req.params.id,
      { title, content, type, isPinned },
      { new: true }
    ).populate('author', 'fullName memberId');

    if (!news) {
      return res.status(404).json({ success: false, message: 'الخبر غير موجود' });
    }

    res.json({ success: true, news });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// إحصائيات الأخبار (أدمن فقط)
exports.getNewsStats = async (req, res) => {
  try {
    const stats = await News.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
        }
      }
    ]);

    const totalNews = await News.countDocuments();
    const totalViews = await News.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);

    const topNews = await News.find()
      .populate('author', 'fullName')
      .sort({ views: -1 })
      .limit(5)
      .select('title views type createdAt');

    res.json({
      success: true,
      stats: {
        total: totalNews,
        totalViews: totalViews[0]?.total || 0,
        byType: stats,
        topNews,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
