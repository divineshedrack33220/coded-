const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../Uploads', file.fieldname === 'image' ? 'images' : 'paymentProofs');
    console.log('Multer destination:', uploadDir); // Debug
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`;
    console.log('Multer filename:', filename); // Debug
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    console.log('File filter:', { originalname: file.originalname, mimetype: file.mimetype }); // Debug
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
  },
});

module.exports = upload;