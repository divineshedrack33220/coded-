const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },
  fullName: { type: String, trim: true },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  location: { type: String },
  role: { type: String, enum: ['friends', 'dates', 'companions', 'escort', 'networking'] },
  bio: { type: String },
  avatar: { type: String },
  images: [{ type: String }],
  isOnline: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  connections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
