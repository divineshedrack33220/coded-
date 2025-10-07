const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Post = require('../models/Post');

exports.createChat = async (req, res) => {
  try {
    const { recipient, postId } = req.body;
    const userId = req.user._id;

    console.log('Creating chat:', { userId, recipient, postId });

    if (!recipient || !mongoose.Types.ObjectId.isValid(recipient)) {
      return res.status(400).json({ error: 'Valid recipient ID is required' });
    }

    if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const recipientUser = await User.findById(recipient).select('fullName avatar isOnline');
    if (!recipientUser) {
      console.error('Recipient not found:', recipient);
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check for existing chat between these two users (ignore postId for deduplication)
    let chat = await Chat.findOne({
      users: { $all: [userId, recipient], $size: 2 },
    });

    if (!chat) {
      const post = postId ? await Post.findById(postId).select('content') : null;
      const initialMessage = post ? `Chat started for post: ${post.content.substring(0, 50)}...` : 'Chat started';

      chat = new Chat({
        users: [userId, recipient],
        postId: postId || null,
        lastMessage: initialMessage,
        messages: postId
          ? [{ text: initialMessage, sender: userId, createdAt: new Date() }]
          : [],
        updatedAt: new Date(),
      });
      await chat.save();

      if (req.io) {
        console.log('Emitting new-chat to:', recipient, userId);
        req.io.to(recipient.toString()).emit('new-chat', {
          _id: chat._id,
          user: {
            _id: userId,
            name: req.user.fullName,
            profilePicture: req.user.avatar,
            isOnline: req.user.isOnline,
          },
          lastMessage: chat.lastMessage,
          updatedAt: chat.updatedAt,
          postId: chat.postId || null,
        });
        req.io.to(userId.toString()).emit('new-chat', {
          _id: chat._id,
          user: {
            _id: recipient,
            name: recipientUser.fullName,
            profilePicture: recipientUser.avatar,
            isOnline: recipientUser.isOnline,
          },
          lastMessage: chat.lastMessage,
          updatedAt: chat.updatedAt,
          postId: chat.postId || null,
        });
      }
    } else {
      // If chat exists, update postId if provided and not already set
      if (postId && !chat.postId) {
        chat.postId = postId;
        const post = await Post.findById(postId).select('content');
        chat.lastMessage = post ? `Chat started for post: ${post.content.substring(0, 50)}...` : chat.lastMessage;
        chat.updatedAt = new Date();
        await chat.save();
      }
    }

    res.json({
      _id: chat._id,
      recipient: {
        _id: recipientUser._id,
        name: recipientUser.fullName,
        profilePicture: recipientUser.avatar,
        isOnline: recipientUser.isOnline,
      },
      postId: chat.postId,
    });
  } catch (error) {
    console.error('Create chat error:', error.message);
    res.status(500).json({ error: 'Failed to create chat', details: error.message });
  }
};

exports.getChats = async (req, res) => {
  try {
    console.log('Fetching chats for user:', req.user._id);
    const chats = await Chat.find({ users: req.user._id })
      .populate({
        path: 'users',
        select: 'fullName avatar isOnline',
      })
      .select('_id users lastMessage updatedAt postId')
      .sort({ updatedAt: -1 })
      .lean();

    // Group chats by recipient and select the most recent one
    const chatMap = new Map();
    chats.forEach(chat => {
      if (chat.users.length !== 2) return; // Skip invalid chats
      const recipient = chat.users.find(u => u._id.toString() !== req.user._id.toString());
      if (!recipient) return;
      const recipientId = recipient._id.toString();
      if (!chatMap.has(recipientId) || chatMap.get(recipientId).updatedAt < chat.updatedAt) {
        chatMap.set(recipientId, {
          _id: chat._id,
          recipient: {
            _id: recipient._id,
            name: recipient.fullName,
            profilePicture: recipient.avatar,
            isOnline: recipient.isOnline,
          },
          lastMessage: chat.lastMessage,
          updatedAt: chat.updatedAt,
          postId: chat.postId,
        });
      }
    });

    const validChats = Array.from(chatMap.values());
    console.log('Valid chats (deduplicated):', validChats);
    res.json(validChats);
  } catch (error) {
    console.error('Get chats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch chats', details: error.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    console.log('Fetching chat:', chatId);
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await Chat.findOne({ _id: chatId, users: req.user._id })
      .populate({
        path: 'users',
        select: 'fullName avatar isOnline',
      })
      .select('_id users lastMessage updatedAt postId')
      .lean();

    if (!chat) {
      console.error('Chat not found:', chatId);
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    const recipient = chat.users.find(u => u._id.toString() !== req.user._id.toString());
    const transformedChat = {
      _id: chat._id,
      recipient: {
        _id: recipient._id,
        name: recipient.fullName,
        profilePicture: recipient.avatar,
        isOnline: recipient.isOnline,
      },
      lastMessage: chat.lastMessage,
      updatedAt: chat.updatedAt,
      postId: chat.postId,
    };

    res.json(transformedChat);
  } catch (error) {
    console.error('Get chat by ID error:', error.message);
    res.status(500).json({ error: 'Failed to fetch chat', details: error.message });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    console.log('Fetching messages for chat:', chatId);
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chat = await Chat.findOne({ _id: chatId, users: req.user._id })
      .populate('users', 'fullName avatar isOnline');
    if (!chat) {
      console.error('Chat not found:', chatId);
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    const recipient = chat.users.find(u => u._id.toString() !== req.user._id.toString());
    res.json({
      messages: chat.messages.map(msg => ({
        text: msg.text,
        isSent: msg.sender.toString() === req.user._id.toString(),
        createdAt: msg.createdAt,
      })),
      recipient: {
        _id: recipient._id,
        name: recipient.fullName,
        profilePicture: recipient.avatar,
        isOnline: recipient.isOnline,
      },
      postId: chat.postId,
    });
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { text } = req.body;
    const userId = req.user._id;

    console.log('Sending message:', { chatId, text, userId });

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid message text is required' });
    }

    const chat = await Chat.findOne({ _id: chatId, users: userId });
    if (!chat) {
      console.error('Chat not found:', chatId);
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    const message = {
      text: text.trim(),
      sender: userId,
      createdAt: new Date(),
    };

    chat.messages.push(message);
    chat.lastMessage = message.text;
    chat.updatedAt = message.createdAt;
    await chat.save();

    if (req.io) {
      const recipient = chat.users.find(u => u._id.toString() !== userId.toString());
      console.log('Emitting new-message to:', recipient._id.toString());
      req.io.to(recipient._id.toString()).emit('new-message', {
        chatId: chat._id,
        message: {
          text: message.text,
          isSent: false,
          createdAt: message.createdAt,
        },
      });
    }

    res.json({
      text: message.text,
      isSent: true,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
};