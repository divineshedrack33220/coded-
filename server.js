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

// Load environment variables
dotenv.config();

// Initialize Express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Configure MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'Uploads', file.fieldname === 'image' ? 'images' : 'paymentProofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/chats', require('./routes/chats'));

// Payment proof upload route
app.post('/api/payments/upload', auth, upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No payment proof uploaded');
      return res.status(400).json({ error: 'No payment proof uploaded' });
    }
    const { purpose, postId, amount } = req.body;
    if (!purpose || !['post_creation', 'post_extension', 'unlock_acceptances'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid or missing payment purpose' });
    }
    if ((purpose === 'post_creation' || purpose === 'post_extension') && !postId) {
      return res.status(400).json({ error: 'Post ID required for post-related payments' });
    }
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }
    const payment = new Payment({
      user: req.user._id,
      post: postId || null,
      purpose,
      proofPath: req.file.path,
      amount: parseFloat(amount) || 0,
      reference: `PAYMENT-${Date.now()}`,
    });
    await payment.save();
    console.log('Payment proof uploaded:', { filename: req.file.filename, purpose, postId });
    res.json({ message: 'Payment proof uploaded, pending verification', paymentId: payment._id });
  } catch (error) {
    console.error('Payment upload error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// User image upload route
app.post('/api/users/upload', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No image uploaded');
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    console.log('Image uploaded:', { filename: req.file.filename, path: req.file.path });
    res.json({ url: `/Uploads/images/${req.file.filename}` });
  } catch (error) {
    console.error('Image upload error:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Serve static files
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Serve auth.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Catch-all route
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] Catch-all triggered for: ${req.method} ${req.url}`);
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && !req.path.includes('..') && req.accepts('html')) {
    return res.sendFile(filePath);
  }
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO
const onlineUsers = new Map();
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('user-connected', async (userId) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });
    console.log(`User ${userId} is online`);
    io.emit('user-status-update', { userId, isOnline: true });
  });

  socket.on('disconnect', async () => {
    const userId = [...onlineUsers.entries()].find(([id, sId]) => sId === socket.id)?.[0];
    if (userId) {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false });
      console.log(`User ${userId} is offline`);
      io.emit('user-status-update', { userId, isOnline: false });
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});