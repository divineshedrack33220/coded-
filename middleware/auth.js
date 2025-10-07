const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  console.log('Auth middleware - Authorization header:', authHeader); // Debug
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Auth middleware - No token provided or invalid format:', authHeader);
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware - Decoded JWT:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware - Token verification error:', error.message, error.stack);
    res.status(401).json({ error: 'Invalid or expired token', details: error.message });
  }
};