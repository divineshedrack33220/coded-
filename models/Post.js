const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 500 },
  sponsored: { type: Boolean, default: false },
  postType: {
    type: String,
    enum: ['quick', 'extended-7', 'extended-30'],
    required: true,
  },
  duration: { type: Number, enum: [1, 7, 30], default: 1 },
  expireAt: {
    type: Date,
    default: function () {
      const days = this.duration || 1;
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    },
  },
  paymentProof: { type: String, default: null },
  image: { type: String, default: null },
  status: {
    type: String,
    enum: ['active', 'expired', 'accepted'],
    default: 'active',
  },
  acceptances: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      acceptedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Indexes
postSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
postSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Post', postSchema);