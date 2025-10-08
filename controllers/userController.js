const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const User = require('../models/User');
const { uploadUsers } = require('../config/cloudinaryConfig');

exports.upload = uploadUsers.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

exports.uploadImages = async (req, res) => {
  try {
    console.log('Upload images request:', {
      userId: req.user?._id,
      files: req.files ? Object.keys(req.files).map(key => ({
        field: key,
        originalname: req.files[key][0]?.originalname,
        mimetype: req.files[key][0]?.mimetype,
        size: req.files[key][0]?.size
      })) : 'No files'
    });

    if (!req.files || (!req.files.avatar && !req.files.images)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const response = {};
    if (req.files.avatar) {
      const avatarUrl = req.files.avatar[0].path;
      if (!avatarUrl.startsWith('https://res.cloudinary.com')) {
        return res.status(400).json({ error: 'Invalid Cloudinary URL for avatar' });
      }
      console.log('Processing avatar upload:', {
        originalname: req.files.avatar[0].originalname,
        cloudinaryUrl: avatarUrl
      });
      response.avatarUrl = avatarUrl;
    }
    if (req.files.images) {
      const imageUrls = req.files.images.map(file => file.path).filter(url => url.startsWith('https://res.cloudinary.com'));
      if (imageUrls.length !== req.files.images.length) {
        return res.status(400).json({ error: 'One or more invalid Cloudinary URLs for images' });
      }
      console.log('Processing images upload:', req.files.images.map(file => ({
        originalname: file.originalname,
        cloudinaryUrl: file.path
      })));
      response.imageUrls = imageUrls;
    }

    res.json({ url: response.avatarUrl || (response.imageUrls && response.imageUrls[0]), ...response });
  } catch (error) {
    console.error('Image upload error:', {
      message: error.message,
      stack: error.stack,
      cloudinaryError: error.http_code ? {
        http_code: error.http_code,
        details: error.message
      } : null
    });
    if (error.message.includes('Only JPEG or PNG images are allowed')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.http_code) {
      return res.status(400).json({ error: 'Cloudinary upload failed', details: error.message });
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

exports.createProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log('Create profile request:', req.user._id, req.body, req.files);
    const { fullName, email, phone, age, gender, location, role, bio } = req.body;

    if (!fullName || !email || !phone || !age || !gender || !location || !role || !bio) {
      console.error('Missing required fields:', { fullName, email, phone, age, gender, location, role, bio });
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'All fields (fullName, email, phone, age, gender, location, role, bio) are required' });
    }

    const user = await User.findById(req.user._id).session(session);
    if (!user) {
      console.error('User not found for ID:', req.user._id);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'User not found' });
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Age must be a number between 18 and 99' });
    }
    if (!['male', 'female', 'other'].includes(gender)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid gender' });
    }
    if (!['friends', 'dates', 'companions', 'escort', 'networking'].includes(role)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (bio.length > 300) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Bio must be 300 characters or less' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (fullName.trim().length < 2) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Full name must be at least 2 characters long' });
    }

    user.fullName = fullName.trim();
    user.email = email.toLowerCase().trim();
    user.phone = phone;
    user.age = ageNum;
    user.gender = gender;
    user.location = location;
    user.role = role;
    user.bio = bio;

    if (req.files) {
      if (req.files.avatar) {
        const avatarUrl = req.files.avatar[0].path;
        if (!avatarUrl.startsWith('https://res.cloudinary.com')) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Invalid Cloudinary URL for avatar' });
        }
        user.avatar = avatarUrl;
      }
      if (req.files.images) {
        const imageUrls = req.files.images.map(file => file.path).filter(url => url.startsWith('https://res.cloudinary.com'));
        if (imageUrls.length !== req.files.images.length) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'One or more invalid Cloudinary URLs for images' });
        }
        if (imageUrls.length > 5) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Maximum 5 images allowed' });
        }
        if (user.avatar && imageUrls.includes(user.avatar)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Avatar cannot be the same as any additional image' });
        }
        user.images = imageUrls;
      } else {
        user.images = [];
      }
    } else {
      user.avatar = user.avatar || null;
      user.images = [];
    }

    await user.save({ validateBeforeSave: true, session });
    await session.commitTransaction();
    session.endSession();
    console.log('Profile created for user:', req.user._id, { fullName: user.fullName, email: user.email });
    res.json({
      message: 'Profile created successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        age: user.age,
        gender: user.gender,
        location: user.location,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        images: user.images,
        verified: user.verified,
        connections: user.connections || [],
        posts: user.posts || [],
        rating: user.rating || { average: 0, count: 0 },
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create profile error:', error.message, error.stack);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use` });
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log('Update profile request:', req.user._id, req.body, req.files);
    const { fullName, email, phone, age, gender, location, role, bio, avatar, images } = req.body;

    const user = await User.findById(req.user._id).session(session);
    if (!user) {
      console.error('User not found for ID:', req.user._id);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedFields = {};

    if (fullName) {
      if (fullName.trim().length < 2) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Full name must be at least 2 characters long' });
      }
      user.fullName = fullName.trim();
      updatedFields.fullName = fullName.trim();
    }
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } }).session(session);
      if (existingUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email.toLowerCase().trim();
      updatedFields.email = email.toLowerCase().trim();
    }
    if (phone) {
      if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
      const existingUser = await User.findOne({ phone, _id: { $ne: req.user._id } }).session(session);
      if (existingUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Phone number already in use' });
      }
      user.phone = phone;
      updatedFields.phone = phone;
    }
    if (age) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Age must be a number between 18 and 99' });
      }
      user.age = ageNum;
      updatedFields.age = ageNum;
    }
    if (gender) {
      if (!['male', 'female', 'other'].includes(gender)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Invalid gender' });
      }
      user.gender = gender;
      updatedFields.gender = gender;
    }
    if (location) {
      user.location = location;
      updatedFields.location = location;
    }
    if (role) {
      if (!['friends', 'dates', 'companions', 'escort', 'networking'].includes(role)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Invalid role' });
      }
      user.role = role;
      updatedFields.role = role;
    }
    if (bio) {
      if (bio.length > 300) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Bio must be 300 characters or less' });
      }
      user.bio = bio;
      updatedFields.bio = bio;
    }
    if (avatar && !req.files?.avatar) {
      if (!avatar.startsWith('https://res.cloudinary.com')) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Invalid Cloudinary URL for avatar' });
      }
      user.avatar = avatar;
      updatedFields.avatar = avatar;
    }
    if (images) {
      const parsedImages = Array.isArray(images) ? images : JSON.parse(images || '[]');
      if (parsedImages.length > 5) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Maximum 5 images allowed' });
      }
      if (!parsedImages.every(url => url.startsWith('https://res.cloudinary.com'))) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'One or more invalid Cloudinary URLs for images' });
      }
      if (user.avatar && parsedImages.includes(user.avatar)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Avatar cannot be the same as any additional image' });
      }
      user.images = parsedImages;
      updatedFields.images = parsedImages;
    }
    if (req.files) {
      if (req.files.avatar) {
        const avatarUrl = req.files.avatar[0].path;
        if (!avatarUrl.startsWith('https://res.cloudinary.com')) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Invalid Cloudinary URL for avatar' });
        }
        user.avatar = avatarUrl;
        updatedFields.avatar = avatarUrl;
      }
      if (req.files.images) {
        const imageUrls = req.files.images.map(file => file.path).filter(url => url.startsWith('https://res.cloudinary.com'));
        if (imageUrls.length !== req.files.images.length) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'One or more invalid Cloudinary URLs for images' });
        }
        if (imageUrls.length > 5) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Maximum 5 images allowed' });
        }
        if (user.avatar && imageUrls.includes(user.avatar)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: 'Avatar cannot be the same as any additional image' });
        }
        user.images = imageUrls;
        updatedFields.images = imageUrls;
      }
    }

    if (Object.keys(updatedFields).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    await user.save({ validateBeforeSave: true, session });
    await session.commitTransaction();
    session.endSession();
    console.log('Profile updated for user:', req.user._id, 'Updated fields:', updatedFields);

    const updatedUser = await User.findById(req.user._id).populate({
      path: 'posts',
      populate: { path: 'user', select: 'fullName avatar' },
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        age: updatedUser.age,
        gender: updatedUser.gender,
        location: updatedUser.location,
        role: updatedUser.role,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        images: updatedUser.images || [],
        verified: updatedUser.verified,
        connections: updatedUser.connections || [],
        posts: updatedUser.posts || [],
        rating: updatedUser.rating || { average: 0, count: 0 },
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update profile error:', error.message, error.stack);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use` });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};
