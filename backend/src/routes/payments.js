const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');
const { query, withTransaction } = require('../database/connection');
const {
  createCheckoutSchema,
  webhookEventSchema,
  subscriptionActionSchema,
  validateRequest,
  validateWebhookSignature,
  checkSubscriptionStatus
} = require('../middleware/payment');
const router = express.Router();

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: {
      projects: 3,
      aiGenerations: 10,
      exports: 'watermarked',
      support: 'community'
    }
  },
  pro: {
    name: 'Pro',
    price: 1900, // $19.00 in cents
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      projects: 100,
      aiGenerations: 1000,
      exports: 'hd',
      support: 'email'
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 9900, // $99.00 in cents
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: {
      projects: 1000,
      aiGenerations: 10000,
      exports: 'hd',
      support: 'priority',
      collaboration: true,
      whiteLabel: true
    }
  }
};

// Get subscription plans
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: SUBSCRIPTION_PLANS
  });
});

// Create checkout session
router.post('/create-checkout-session', authenticateToken, validateRequest(createCheckoutSchema), async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, metadata = {} } = req.body;
    const userId = req.user.id;

    // Get user from database
    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Create or get Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        metadata: {
          userId: userId
        }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        ...metadata
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// Get current subscription
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let subscription = null;
    if (user.stripeSubscriptionId) {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    }

    res.json({
      success: true,
      subscription: {
        plan: user.subscriptionPlan || 'free',
        status: subscription?.status || 'inactive',
        currentPeriodEnd: subscription?.current_period_end,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end,
        features: SUBSCRIPTION_PLANS[user.subscriptionPlan || 'free'].features
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      cancelAt: subscription.cancel_at
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

// Reactivate subscription
router.post('/reactivate-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate subscription'
    });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({error: 'Webhook handling failed'});
  }
});

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id;
  const planId = session.metadata.planId;
  
  if (userId && planId) {
    await User.findByIdAndUpdate(userId, {
      subscriptionPlan: planId,
      stripeCustomerId: session.customer,
      subscriptionStartDate: new Date(),
      subscriptionStatus: 'active'
    });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionEndDate: new Date(subscription.current_period_end * 1000)
    });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const user = await User.findOne({ stripeCustomerId: subscription.customer });
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      subscriptionPlan: 'free',
      subscriptionStatus: 'cancelled',
      stripeSubscriptionId: null,
      subscriptionEndDate: new Date()
    });
  }
}

async function handlePaymentSucceeded(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      lastPaymentDate: new Date(),
      subscriptionStatus: 'active'
    });
  }
}

async function handlePaymentFailed(invoice) {
  const user = await User.findOne({ stripeCustomerId: invoice.customer });
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      subscriptionStatus: 'past_due'
    });
  }
}

module.exports = router;
