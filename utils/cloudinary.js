const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadBase64 = async (base64String) => {
  const result = await cloudinary.uploader.upload(base64String, {
    folder: 'family-tree',
    resource_type: 'image',
  });
  return result.secure_url;
};

module.exports = { uploadBase64 };
