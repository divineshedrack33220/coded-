const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createProfile,
  updateProfile,
  getProfile,
  getUserProfile,
  getNearbyUsers,
  getCurrentUser,
  getAccountDetails,
  upload,
  uploadImages,
} = require('../controllers/userController'); // Fixed typo: serController -> userController
const User = require('../models/User');

// Ensure JSON response only once
router.use(express.json());

// Upload images route
router.post('/upload', auth, upload, uploadImages); // Changed from /uploadImages to /upload

// Profile routes
router.post('/profile', auth, createProfile);
router.put('/profile', auth, updateProfile);
router.get('/profile', auth, getProfile);
router.get('/current', auth, getCurrentUser);
router.get('/account-details', auth, getAccountDetails);
router.get('/nearby', auth, getNearbyUsers);

// Get user profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('posts');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      age: user.age || 'N/A',
      location: user.location || 'N/A',
      role: user.role || 'N/A',
      email: user.email || 'N/A',
      phone: user.phone || 'N/A',
      gender: user.gender || 'N/A',
      bio: user.bio || 'N/A',
      joined: user.joined ? user.joined.toISOString().split('T')[0] : 'N/A',
      images: user.images?.length > 0 ? user.images : ['/Uploads/placeholder.jpg'],
      connections: user.connections?.length || 0,
      posts: user.posts || [],
      rating: user.rating?.average || 0,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message,
    });
  }
});

// Rate a user
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already rated
    const existingRating = user.rating.ratings.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existingRating) {
      existingRating.value = rating;
    } else {
      user.rating.ratings.push({ user: req.user._id, value: rating });
      user.rating.count = user.rating.ratings.length;
    }

    // Recalculate average
    const total = user.rating.ratings.reduce((sum, r) => sum + r.value, 0);
    user.rating.average = total / user.rating.ratings.length;

    await user.save();

    res.status(200).json({
      message: 'Rating submitted successfully',
      averageRating: user.rating.average,
    });
  } catch (error) {
    console.error('Rate user error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
