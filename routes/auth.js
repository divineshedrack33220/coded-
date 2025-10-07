const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = '12239007321-kcvn3r3asgef4ic341tnvbn2bpt8i9qg.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/signup', async (req, res) => {
    try {
        const { email, phone, password } = req.body;
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
            { _id: user._id, isOnline: user.isOnline, fullName: user.fullName, avatar: user.avatar },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        console.log('User created and token generated:', { userId: user._id, token });
        if (req.io) {
            req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
        }
        res.json({ token });
    } catch (error) {
        console.error('Signup error:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        user.isOnline = true;
        await user.save();
        const token = jwt.sign(
            { _id: user._id, isOnline: user.isOnline, fullName: user.fullName, avatar: user.avatar },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        console.log('Token generated for user:', { userId: user._id, token });
        if (req.io) {
            req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
        }
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

router.post('/google', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'No ID token provided' });
    }

    try {
        // Verify Google ID token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const fullName = payload['name'];
        const avatar = payload['picture'];

        // Check if user exists
        let user = await User.findOne({ googleId });
        if (!user) {
            // Check if email exists (to link Google account)
            user = await User.findOne({ email });
            if (user) {
                // Link Google ID to existing user
                user.googleId = googleId;
                user.fullName = user.fullName || fullName;
                user.avatar = user.avatar || avatar;
            } else {
                // Create new user (signup)
                user = new User({
                    googleId,
                    email,
                    fullName,
                    avatar,
                    isOnline: true,
                    // Set default values for required fields
                    phone: `google-${googleId}`, // Temporary placeholder, to be updated in profile setup
                    password: `google-${googleId}` // Temporary placeholder, not used for Google login
                });
            }
            await user.save();
        } else {
            // Update user info (login)
            user.fullName = fullName;
            user.avatar = avatar;
            user.isOnline = true;
            await user.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { _id: user._id, isOnline: user.isOnline, fullName: user.fullName, avatar: user.avatar },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        console.log('Google auth successful:', { userId: user._id, token });
        if (req.io) {
            req.io.emit('user-status-update', { userId: user._id.toString(), isOnline: true });
        }
        res.json({ token });
    } catch (error) {
        console.error('Google auth error:', error.message);
        res.status(401).json({ error: 'Invalid Google token', details: error.message });
    }
});

module.exports = router;