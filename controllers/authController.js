const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.signup = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    console.log('Signup attempt:', { email, phone });

    if (!email || !phone || !password) {
      return res.status(400).json({ error: 'Email, phone, and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or phone already exists' });
    }

    const user = new User({ email, phone, password });
    await user.save();

    const token = jwt.sign(
      {
        _id: user._id,
        fullName: user.fullName,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (req.io) {
      req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
    }

    res.status(201).json({ token });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to sign up', details: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', { email });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email/phone and password are required' });
    }

    const user = await User.findOne({
      $or: [{ email }, { phone: email }],
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.isOnline = true;
    await user.save();

    const token = jwt.sign(
      {
        _id: user._id,
        fullName: user.fullName,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (req.io) {
      req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
    }

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
};