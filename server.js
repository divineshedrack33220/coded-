const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const User = require('./models/User');
const Payment = require('./models/Payment');
const auth = require('./middleware/auth');

// Load env
dotenv.config();

// App & Server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['https://codedsignal.org', 'http://localhost:5000'],
    methods: ['GET', 'POST'],
  },
});

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// FIXED: Use Render writable dir + map to /Uploads URL
const UPLOAD_BASE = process.env.UPLOAD_DIR || '/tmp/uploads'; // Render-safe

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir =
      file.fieldname === 'image'
        ? path.join(UPLOAD_BASE, 'images')
        : path.join(UPLOAD_BASE, 'paymentProofs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware
app.use(cors({ origin: ['https://codedsignal.org', 'http://localhost:5000'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.io = io;
  next();
});

// FIXED: Only ONE correct COOP/COEP header (Google Sign-In + PWA safe)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Simple request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/chats', require('./routes/chats'));

// Payment proof upload
app.post('/api/payments/upload', auth, upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No payment proof uploaded' });

    const { purpose, postId, amount } = req.body;
    if (!purpose || !['post_creation', 'post_extension', 'unlock_acceptances'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid or missing payment purpose' });
    }
    if ((purpose === 'post_creation' || purpose === 'post_extension') && !postId) {
      return res.status(400).json({ error: 'Post ID required' });
    }
    if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const payment = new Payment({
      user: req.user._id,
      post: postId || null,
      purpose,
      proofPath: req.file.path.replace('/tmp/uploads', '/Uploads'), // maps to public URL
      amount: parseFloat(amount) || 0,
      reference: `PAY-${Date.now()}`,
    });
    await payment.save();

    res.json({ message: 'Payment proof uploaded, pending verification', paymentId: payment._id });
  } catch (error) {
    console.error('Payment upload error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Profile image upload
app.post('/api/users/upload', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const imageUrl = `https://codedsignal.org/Uploads/images/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Serve uploaded files (mapped from /tmp/uploads → /Uploads)
app.use('/Uploads', express.static(UPLOAD_BASE));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all + 404
app.use((req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && !req.path.includes('..') && req.accepts('html')) {
    return res.sendFile(filePath);
  }
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.status(404).json({ error: 'Not found' });
});

// Socket.IO - Online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id);

  socket.on('user-connected', async (userId) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('user-status-update', { userId, isOnline: true });
  });

  socket.on('disconnect', async () => {
    const userId = [...onlineUsers.entries()].find(([id, sid]) => sid === socket.id)?.[0];
    if (userId) {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false });
      io.emit('user-status-update', { userId, isOnline: false });
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Live at https://codedsignal.org`);
});
