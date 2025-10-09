const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.signup = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    console.log('Signup attempt:', { email, phone });

    if (!email || !phone || !password) {
      return res.status(400).json({ error: 'Email, phone, and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: existingUser.email === email ? 'Email already registered' : 'Phone number already registered' });
    }

    const user = new User({ email, phone, password });
    await user.save();

    const token = jwt.sign(
      {
        _id: user._id,
        isOnline: user.isOnline,
        fullName: user.fullName,
        avatar: user.avatar,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (req.io) {
      req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
    }

    res.json({ token, isNewUser: true });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', { email });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ $or: [{ email }, { phone: email }] });
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
        isOnline: user.isOnline,
        fullName: user.fullName,
        avatar: user.avatar,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (req.io) {
      req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
    }

    res.json({ token, isNewUser: false });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

exports.googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'No ID token provided' });
  }

  try {
    console.log('Google auth attempt:', { idToken: idToken.substring(0, 10) + '...' });

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];
    const fullName = payload['name'];
    const avatar = payload['picture'];

    // Check if user exists
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNewUser = false;

    if (!user) {
      // Create new user (signup)
      user = new User({
        googleId,
        email,
        fullName,
        avatar,
        isOnline: true,
        phone: `google-${googleId}`, // Temporary placeholder
        password: `google-${googleId}`, // Temporary placeholder
      });
      await user.save();
      isNewUser = true;
    } else {
      // Update existing user (login)
      if (!user.googleId) {
        user.googleId = googleId;
      }
      user.fullName = fullName || user.fullName;
      user.avatar = avatar || user.avatar;
      user.isOnline = true;
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      {
        _id: user._id,
        isOnline: user.isOnline,
        fullName: user.fullName,
        avatar: user.avatar,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Google auth successful:', { userId: user._id, token });

    if (req.io) {
      req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
    }

    res.json({ token, isNewUser });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(401).json({ error: 'Invalid Google token', details: error.message });
  }
};

module.exports = {
  signup: exports.signup,
  login: exports.login,
  googleAuth: exports.googleAuth,
};
