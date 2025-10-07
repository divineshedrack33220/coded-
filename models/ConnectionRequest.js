// models/ConnectionRequest.js
const mongoose = require('mongoose');

const connectionRequestSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

connectionRequestSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('ConnectionRequest', connectionRequestSchema);