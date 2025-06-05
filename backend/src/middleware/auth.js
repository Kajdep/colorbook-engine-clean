const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'access') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired token'
      });
    }

    // Get user from database to ensure they still exist and are active
    const userResult = await query(
      'SELECT id, email, username, subscription_tier, subscription_status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Check if subscription is active (if required)
    if (user.subscription_status !== 'active') {
      // Allow basic access but add flag
      user.hasActiveSubscription = false;
    } else {
      user.hasActiveSubscription = true;
    }

    // Add user to request object
    req.user = user;

    // Update last login time
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.type === 'access') {
        const userResult = await query(
          'SELECT id, email, username, subscription_tier FROM users WHERE id = $1',
          [decoded.userId]
        );
        
        if (userResult.rows.length > 0) {
          req.user = userResult.rows[0];
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if there's an error
    next();
  }
};

// Subscription tier middleware
const requireSubscription = (requiredTier = 'pro') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const tierLevels = {
      'free': 0,
      'pro': 1,
      'enterprise': 2
    };

    const userLevel = tierLevels[req.user.subscription_tier] || 0;
    const requiredLevel = tierLevels[requiredTier] || 1;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Subscription Required',
        message: `This feature requires a ${requiredTier} subscription`,
        currentTier: req.user.subscription_tier,
        requiredTier
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireSubscription
};