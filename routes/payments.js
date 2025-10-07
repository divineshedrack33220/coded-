const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

// Admin middleware (example, adjust based on your auth logic)
const isAdmin = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'admin') { // Assuming 'admin' role
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get pending payments
router.get('/pending', auth, isAdmin, async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending' })
      .populate('user', 'fullName email')
      .populate('post', 'content');
    res.json(payments);
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify payment
router.put('/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    payment.status = 'verified';
    await payment.save();
    res.json({ message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject payment
router.put('/:id/reject', auth, isAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    payment.status = 'rejected';
    await payment.save();
    res.json({ message: 'Payment rejected' });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;