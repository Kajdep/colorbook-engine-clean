// Payment validation and subscription middleware
const { query } = require('../database/connection');
const Joi = require('joi');

// Payment validation schemas
const createCheckoutSchema = Joi.object({
  priceId: Joi.string().required(),
  successUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().required(),
  metadata: Joi.object().optional()
});

const webhookEventSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().required(),
  data: Joi.object().required(),
  created: Joi.number().required()
});

const subscriptionActionSchema = Joi.object({
  subscriptionId: Joi.string().required(),
  action: Joi.string().valid('cancel', 'reactivate', 'update').required(),
  newPriceId: Joi.string().when('action', {
    is: 'update',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Subscription status check middleware
const checkSubscriptionStatus = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'User must be authenticated to check subscription status'
      });
    }

    // Get user's current subscription
    const userResult = await query(
      'SELECT subscription_tier, subscription_status, subscription_expires_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User account not found'
      });
    }

    const user = userResult.rows[0];
    const now = new Date();
    
    // Check if subscription is expired
    if (user.subscription_expires_at && new Date(user.subscription_expires_at) < now) {
      // Update user to free tier if subscription expired
      await query(
        'UPDATE users SET subscription_tier = $1, subscription_status = $2 WHERE id = $3',
        ['free', 'expired', req.user.id]
      );
      
      user.subscription_tier = 'free';
      user.subscription_status = 'expired';
    }

    // Add subscription info to request
    req.subscription = {
      tier: user.subscription_tier,
      status: user.subscription_status,
      expiresAt: user.subscription_expires_at
    };

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({
      error: 'Subscription Check Failed',
      message: 'Failed to verify subscription status'
    });
  }
};

// Feature access control middleware
const requireSubscription = (requiredTier = 'pro') => {
  const tierLevels = {
    'free': 0,
    'pro': 1,
    'enterprise': 2
  };

  return async (req, res, next) => {
    try {
      // First check subscription status
      await checkSubscriptionStatus(req, res, () => {});
      
      if (res.headersSent) return; // If checkSubscriptionStatus sent an error response

      const userTierLevel = tierLevels[req.subscription.tier] || 0;
      const requiredTierLevel = tierLevels[requiredTier] || 1;

      if (userTierLevel < requiredTierLevel) {
        return res.status(403).json({
          error: 'Subscription Required',
          message: `This feature requires a ${requiredTier} subscription or higher`,
          currentTier: req.subscription.tier,
          requiredTier: requiredTier,
          upgradeUrl: '/subscription/upgrade'
        });
      }

      // Check if subscription is active
      if (req.subscription.status !== 'active' && req.subscription.tier !== 'free') {
        return res.status(403).json({
          error: 'Inactive Subscription',
          message: 'Your subscription is not active. Please update your payment method.',
          status: req.subscription.status,
          manageUrl: '/subscription/manage'
        });
      }

      next();
    } catch (error) {
      console.error('Subscription requirement check error:', error);
      res.status(500).json({
        error: 'Access Control Failed',
        message: 'Failed to verify subscription access'
      });
    }
  };
};

// Usage limits middleware
const checkUsageLimits = (feature) => {
  const limits = {
    free: {
      projects: 3,
      stories_per_month: 10,
      images_per_month: 20,
      exports_per_month: 5
    },
    pro: {
      projects: 50,
      stories_per_month: 200,
      images_per_month: 500,
      exports_per_month: 100
    },
    enterprise: {
      projects: -1, // unlimited
      stories_per_month: -1,
      images_per_month: -1,
      exports_per_month: -1
    }
  };

  return async (req, res, next) => {
    try {
      // First check subscription status
      await checkSubscriptionStatus(req, res, () => {});
      
      if (res.headersSent) return;

      const tier = req.subscription.tier;
      const tierLimits = limits[tier] || limits.free;
      const limit = tierLimits[feature];

      // If unlimited (-1), skip check
      if (limit === -1) {
        return next();
      }

      // Get current usage
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      let usageQuery;
      let usageParams;

      switch (feature) {
        case 'projects':
          usageQuery = 'SELECT COUNT(*) as count FROM projects WHERE user_id = $1';
          usageParams = [req.user.id];
          break;
        case 'stories_per_month':
          usageQuery = 'SELECT COUNT(*) as count FROM stories WHERE user_id = $1 AND created_at >= $2';
          usageParams = [req.user.id, startOfMonth];
          break;
        case 'images_per_month':
          usageQuery = 'SELECT COUNT(*) as count FROM images WHERE user_id = $1 AND created_at >= $2';
          usageParams = [req.user.id, startOfMonth];
          break;
        case 'exports_per_month':
          usageQuery = 'SELECT COUNT(*) as count FROM exports WHERE user_id = $1 AND created_at >= $2';
          usageParams = [req.user.id, startOfMonth];
          break;
        default:
          return next(); // Unknown feature, allow access
      }

      const usageResult = await query(usageQuery, usageParams);
      const currentUsage = parseInt(usageResult.rows[0].count);

      if (currentUsage >= limit) {
        return res.status(429).json({
          error: 'Usage Limit Exceeded',
          message: `You have reached your ${feature} limit for the current period`,
          currentUsage,
          limit,
          tier,
          upgradeUrl: '/subscription/upgrade',
          resetDate: feature.includes('per_month') ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) : null
        });
      }

      // Add usage info to request
      req.usage = {
        current: currentUsage,
        limit,
        remaining: limit - currentUsage
      };

      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({
        error: 'Usage Check Failed',
        message: 'Failed to verify usage limits'
      });
    }
  };
};

// Validate payment webhook signatures (Stripe)
const validateWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({
        error: 'Webhook Validation Failed',
        message: 'Missing webhook signature or secret'
      });
    }

    // Store raw body for Stripe signature verification
    req.rawBody = req.body;
    next();
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    res.status(400).json({
      error: 'Webhook Validation Failed',
      message: 'Invalid webhook signature'
    });
  }
};

// Request validation middleware for payment endpoints
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Payment request validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  // Validation schemas
  createCheckoutSchema,
  webhookEventSchema,
  subscriptionActionSchema,
  
  // Middleware functions
  checkSubscriptionStatus,
  requireSubscription,
  checkUsageLimits,
  validateWebhookSignature,
  validateRequest
};
