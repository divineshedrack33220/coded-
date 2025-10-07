const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    console.log('Cloudinary upload params:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'unknown',
    });
    return {
      folder: 'coded_signals',
      allowed_formats: ['jpg', 'png', 'jpeg'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    };
  },
});

const uploadUsers = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    console.log('File filter:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'unknown',
    });
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG or PNG images are allowed'));
  },
});

module.exports = { uploadUsers };