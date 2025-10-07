const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: false }, // For post creation/extension
  purpose: { type: String, enum: ['post_creation', 'post_extension', 'unlock_acceptances'], required: true },
  proofPath: { type: String, required: true }, // Path to uploaded proof
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  amount: { type: Number }, // Expected amount ($5 for 7 days, $20 for 30 days, etc.)
  reference: { type: String, required: true }, // Payment reference
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);