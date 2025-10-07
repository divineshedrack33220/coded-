const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  users: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ],
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  lastMessage: { type: String, default: '' },
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now },
});

chatSchema.index({ users: 1, updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);