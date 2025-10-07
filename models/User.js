const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true },
        phone: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        googleId: { type: String, unique: true, sparse: true }, // Added for Google Sign-In
        fullName: { type: String },
        age: { type: Number, min: 18, max: 99 },
        gender: { type: String, enum: ['male', 'female', 'other'] },
        location: { type: String },
        role: {
            type: String,
            enum: ['friends', 'dates', 'companions', 'escort', 'networking'],
        },
        bio: { type: String, maxlength: 300 },
        avatar: { type: String },
        images: [{ type: String }],
        verified: { type: Boolean, default: false },
        isOnline: { type: Boolean, default: false },
        connections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
        rating: {
            average: { type: Number, default: 0 },
            count: { type: Number, default: 0 },
            ratings: [
                {
                    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                    value: { type: Number, min: 1, max: 5 },
                },
            ],
        },
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
