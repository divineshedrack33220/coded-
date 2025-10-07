const mongoose = require('mongoose');
const Post = require('../models/Post');
const Payment = require('../models/Payment');
const Chat = require('../models/Chat');
const User = require('../models/User');

// GET ALL POSTS
const getPosts = async (req, res) => {
  try {
    const posts = await Post.find({ status: 'active' }).populate('user', 'fullName avatar');
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts', details: error.message });
  }
};

// CREATE A POST
const createPost = async (req, res) => {
  try {
    const { content, sponsored, postType, duration } = req.body;
    const userId = req.user._id;
    const image = req.files?.image ? req.files.image[0].path : null;
    const paymentProof = req.files?.paymentProof ? req.files.paymentProof[0].path : null;

    const post = new Post({
      user: userId,
      content,
      sponsored,
      postType,
      duration,
      image,
      paymentProof,
    });

    await post.save();
    res.json({ message: 'Post created', post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
};

// EXTEND A POST
const extendPost = async (req, res) => {
  try {
    const { postId, duration } = req.body;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.duration = duration;
    post.expireAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

    await post.save();
    res.json({ message: 'Post extended', post });
  } catch (error) {
    console.error('Extend post error:', error);
    res.status(500).json({ error: 'Failed to extend post', details: error.message });
  }
};

// GET POSTS BY USER
const getUserPosts = async (req, res) => {
  try {
    const userId = req.params.id;
    const posts = await Post.find({ user: userId }).populate('user', 'fullName avatar');
    res.json(posts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Failed to fetch user posts', details: error.message });
  }
};

// ACCEPT REQUEST
const acceptRequest = async (req, res) => {
  try {
    const { postId, paymentId } = req.body;
    const userId = req.user._id;

    console.log('Accept request:', { postId, paymentId, userId });

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Valid post ID is required' });
    }

    if (paymentId && !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const post = await Post.findById(postId).populate('user', 'fullName avatar isOnline');
    if (!post || post.status !== 'active') {
      return res.status(400).json({ error: 'Post not available' });
    }

    const userAcceptances = await Post.aggregate([
      { $unwind: '$acceptances' },
      { $match: { 'acceptances.user': new mongoose.Types.ObjectId(userId) } },
      { $count: 'total' },
    ]);

    const totalAcceptances = userAcceptances[0]?.total || 0;

    if (totalAcceptances >= 5) {
      if (!paymentId) {
        return res.status(403).json({
          error: 'You can only accept up to 5 requests. Pay to unlock more.',
          requiresPayment: true,
          accountDetails: {
            bank: process.env.BANK_NAME || 'Your Bank Name',
            accountNumber: process.env.ACCOUNT_NUMBER || '1234567890',
            accountName: process.env.ACCOUNT_NAME || 'Your App Name',
            reference: `ACCEPT-${Date.now()}`,
          },
        });
      }
      const payment = await Payment.findById(paymentId);
      if (
        !payment ||
        payment.user.toString() !== userId.toString() ||
        payment.purpose !== 'unlock_acceptances'
      ) {
        return res.status(400).json({ error: 'Invalid or missing payment' });
      }
      if (payment.status !== 'verified') {
        return res.status(403).json({ error: 'Payment verification pending' });
      }
    }

    if (!post.acceptances.some((acc) => acc.user.toString() === userId.toString())) {
      post.acceptances.push({ user: userId });
    }

    let chat = await Chat.findOne({
      users: { $all: [userId, post.user._id], $size: 2 },
      postId: postId,
    });

    if (!chat) {
      chat = new Chat({
        users: [userId, post.user._id],
        postId: postId,
        lastMessage: `Chat started for post: ${post.content.substring(0, 50)}...`,
        messages: [
          {
            text: `Chat started for post: ${post.content.substring(0, 50)}...`,
            sender: userId,
            createdAt: new Date(),
          },
        ],
        updatedAt: new Date(),
      });
      await chat.save();
    }

    const accepter = await User.findById(userId).select('fullName avatar isOnline');
    const poster = await User.findById(post.user._id).select('fullName avatar isOnline');

    if (!accepter || !poster) {
      return res.status(400).json({ error: 'User or poster not found' });
    }

    if (post.acceptances.length >= 1 && post.user._id.toString() !== userId.toString()) {
      post.status = 'accepted';
    }

    await post.save();

    if (req.io) {
      req.io.to(post.user._id.toString()).emit('new-chat', {
        _id: chat._id,
        user: {
          _id: userId,
          name: accepter.fullName,
          profilePicture: accepter.avatar,
          isOnline: accepter.isOnline,
        },
        lastMessage: chat.lastMessage,
        updatedAt: chat.updatedAt,
        postId: postId,
      });

      req.io.to(userId.toString()).emit('new-chat', {
        _id: chat._id,
        user: {
          _id: post.user._id,
          name: poster.fullName,
          profilePicture: poster.avatar,
          isOnline: poster.isOnline,
        },
        lastMessage: chat.lastMessage,
        updatedAt: chat.updatedAt,
        postId: postId,
      });

      req.io.emit('post-accepted', { postId });
      console.log('Emitted new-chat events for accepter:', userId, 'and poster:', post.user._id);
    } else {
      console.warn('Socket.IO not available');
    }

    res.json({
      message: 'Request accepted',
      post,
      chatId: chat._id,
    });
  } catch (error) {
    console.error('Accept request error:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.user?._id,
    });
    res.status(500).json({ error: 'Failed to accept request', details: error.message });
  }
};

module.exports = {
  getPosts,
  createPost,
  extendPost,
  getUserPosts,
  acceptRequest,
};