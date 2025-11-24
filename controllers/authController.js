const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------
// Generate JWT
// -------------------------------
function generateToken(user) {
  return jwt.sign(
    {
      _id: user._id,
      fullName: user.fullName,
      avatar: user.avatar,
      isOnline: user.isOnline
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// -------------------------------
// SIGNUP
// -------------------------------
exports.signup = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    console.log("Signup attempt:", { email, phone });

    if (!email || !phone || !password) {
      return res.status(400).json({ error: "Email, phone, and password are required" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        error:
          existingUser.email === email
            ? "Email already registered"
            : "Phone number already registered"
      });
    }

    const user = new User({ email, phone, password });
    await user.save();

    user.isOnline = true;
    await user.save();

    const token = generateToken(user);

    if (req.io) {
      req.io.emit("user-status-update", {
        userId: user._id.toString(),
        isOnline: true
      });
    }

    res.json({ token, isNewUser: true });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// -------------------------------
// LOGIN
// -------------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login attempt:", { email });

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Allow login with phone or email
    const user = await User.findOne({
      $or: [{ email }, { phone: email }]
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.isOnline = true;
    await user.save();

    const token = generateToken(user);

    if (req.io) {
      req.io.emit("user-status-update", {
        userId: user._id.toString(),
        isOnline: true
      });
    }

    res.json({ token, isNewUser: false });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// -------------------------------
// GOOGLE AUTH
// -------------------------------
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body; // IMPORTANT FIX 🔥

    if (!credential) {
      return res.status(400).json({ error: "No Google credential token provided" });
    }

    console.log("Google auth attempt: received credential");

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;

    const email = payload.email;
    const fullName = payload.name;
    const avatar = payload.picture;

    console.log("Google payload:", { email, fullName });

    // Find or create user
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNewUser = false;

    if (!user) {
      user = new User({
        googleId,
        email,
        fullName,
        avatar,
        isOnline: true,
        phone: null,        // FIXED 🔥 no fake phone
        password: null      // FIXED 🔥 no fake password
      });

      await user.save();
      isNewUser = true;
    } else {
      // Update user if needed
      user.googleId = googleId;
      user.fullName = fullName || user.fullName;
      user.avatar = avatar || user.avatar;
      user.isOnline = true;
      await user.save();
    }

    const token = generateToken(user);

    if (req.io) {
      req.io.emit("user-status-update", {
        userId: user._id.toString(),
        isOnline: true
      });
    }

    res.json({ token, isNewUser });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({
      error: "Invalid Google token",
      details: error.message
    });
  }
};

// Export functions
module.exports = {
  signup: exports.signup,
  login: exports.login,
  googleAuth: exports.googleAuth
};
