const { uploadBase64 } = require('../utils/cloudinary');
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
    const { title, content, type, isPinned, images, eventDate, eventLocation } = req.body;

    let imageUrls = [];
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.startsWith('data:')) {
          const url = await uploadBase64(img);
          imageUrls.push(url);
        } else if (img.startsWith('http')) {
          imageUrls.push(img);
        }
      }
    }

    const news = await News.findByIdAndUpdate(
      req.params.id,
      { title, content, type, isPinned, images: imageUrls, eventDate, eventLocation },
      { new: true }
    ).populate('author', 'fullName memberId');

    if (!news) return res.status(404).json({ success: false, message: 'الخبر غير موجود' });
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

// إضافة خبر جديد (أدمن فقط)
exports.createNews = async (req, res) => {
  try {
    const { title, content, type, isPinned, images, eventDate, eventLocation } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'العنوان والمحتوى مطلوبان' });

    let imageUrls = [];
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.startsWith('data:')) {
          const url = await uploadBase64(img);
          imageUrls.push(url);
        } else if (img.startsWith('http')) {
          imageUrls.push(img);
        }
      }
    }

    const news = await News.create({
      title, content, type: type || 'announcement',
      isPinned: isPinned || false,
      images: imageUrls,
      eventDate, eventLocation,
      author: req.member._id,
    });

    const populated = await News.findById(news._id).populate('author', 'fullName memberId');
    res.json({ success: true, news: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
