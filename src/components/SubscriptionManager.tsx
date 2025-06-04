import React, { useState, useEffect } from 'react';
import {
  Check,
  Star,
  Zap,
  Crown,
  Settings,
  Loader
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  priceId: string;
  icon: any;
  color: string;
  popular?: boolean;
  features: {
    projects: number | string;
    aiGenerations: number | string;
    exports: string;
    support: string;
    collaboration?: boolean;
    whiteLabel?: boolean;
  };
}

interface UserSubscription {
  tier: string;
  status: string;
  expiresAt?: string;
  customerId?: string;
  subscriptionId?: string;
}

const SubscriptionManager: React.FC = () => {
  const { user, addNotification } = useAppStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const defaultPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'forever',
      priceId: '',
      icon: Star,
      color: 'from-gray-500 to-gray-600',
      features: {
        projects: 3,
        aiGenerations: 10,
        exports: 'watermarked',
        support: 'community'
      }
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 19,
      period: 'month',
      priceId: process.env.VITE_STRIPE_PRO_PRICE_ID || '',
      icon: Zap,
      color: 'from-blue-500 to-purple-600',
      popular: true,
      features: {
        projects: 100,
        aiGenerations: 1000,
        exports: 'HD',
        support: 'email'
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 99,
      period: 'month',
      priceId: process.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || '',
      icon: Crown,
      color: 'from-purple-500 to-pink-600',
      features: {
        projects: 'unlimited',
        aiGenerations: 'unlimited',
        exports: 'HD',
        support: 'priority',
        collaboration: true,
        whiteLabel: true
      }
    }
  ];

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Fetch available plans
      const plansResponse = await fetch('/api/payments/plans');
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans ? Object.values(plansData.plans) : defaultPlans);
      } else {
        setPlans(defaultPlans);
      }

      // Fetch user subscription status
      const token = localStorage.getItem('authToken');
      if (token) {
        const subscriptionResponse = await fetch('/api/payments/subscription', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          setUserSubscription(subscriptionData.subscription);
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      addNotification({ message: 'Failed to load subscription information', type: 'error' });
      setPlans(defaultPlans);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (priceId: string, planName: string) => {
    if (!user) {
      addNotification({ message: 'Please log in to upgrade your subscription', type: 'error' });
      return;
    }

    try {
      setUpgradeLoading(true);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/subscription/success`,
          cancelUrl: `${window.location.origin}/subscription`,
          metadata: {
            planName
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
      
    } catch (error) {
      console.error('Upgrade error:', error);
      addNotification({ message: 'Failed to start upgrade process', type: 'error' });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!userSubscription?.customerId) {
      addNotification({ message: 'No active subscription to manage', type: 'error' });
      return;
    }

    try {
      setManagingSubscription(true);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/manage-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create management session');
      }

      const { portalUrl } = await response.json();
      window.open(portalUrl, '_blank');
      
    } catch (error) {
      console.error('Management error:', error);
      addNotification({ message: 'Failed to open subscription management', type: 'error' });
    } finally {
      setManagingSubscription(false);
    }
  };

  const formatFeatureValue = (value: number | string): string => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return value;
  };

  const isCurrentPlan = (planId: string): boolean => {
    return userSubscription?.tier === planId;
  };

  const getSubscriptionStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'canceled': return 'text-orange-600';
      case 'expired': return 'text-red-600';
      case 'past_due': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Loading subscription information...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Unlock the full potential of ColorBook Engine with our flexible subscription plans
        </p>
      </div>

      {/* Current Subscription Status */}
      {userSubscription && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-2xl font-bold capitalize">{userSubscription.tier}</span>
                <span className={`font-medium ${getSubscriptionStatusColor(userSubscription.status)}`}>
                  {userSubscription.status}
                </span>
                {userSubscription.expiresAt && (
                  <span className="text-gray-600">
                    Expires: {new Date(userSubscription.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {userSubscription.tier !== 'free' && (
              <button
                onClick={handleManageSubscription}
                disabled={managingSubscription}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {managingSubscription ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4" />
                )}
                Manage Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subscription Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = isCurrentPlan(plan.id);
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-purple-500' : ''
              } ${isCurrent ? 'ring-2 ring-green-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center py-2 text-sm font-semibold">
                  Most Popular
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-2 text-sm font-semibold">
                  Current Plan
                </div>
              )}

              <div className={`p-8 ${plan.popular || isCurrent ? 'pt-12' : ''}`}>
                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 rounded-full bg-gradient-to-r ${plan.color} text-white mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-600">/{plan.period}</span>}
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projects</span>
                    <span className="font-semibold">{formatFeatureValue(plan.features.projects)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">AI Generations</span>
                    <span className="font-semibold">{formatFeatureValue(plan.features.aiGenerations)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Exports</span>
                    <span className="font-semibold">{plan.features.exports}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Support</span>
                    <span className="font-semibold capitalize">{plan.features.support}</span>
                  </div>
                  {plan.features.collaboration && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Team Collaboration</span>
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {plan.features.whiteLabel && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">White Label</span>
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.priceId, plan.name)}
                  disabled={upgradeLoading || isCurrent || !plan.priceId}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50'
                  }`}
                >
                  {upgradeLoading ? (
                    <div className="flex items-center justify-center">
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </div>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : plan.id === 'free' ? (
                    'Free Forever'
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h4>
            <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h4>
            <p className="text-gray-600">We accept all major credit cards through our secure Stripe payment processor.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h4>
            <p className="text-gray-600">Our Free plan lets you try ColorBook Engine with no time limit and basic features.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h4>
            <p className="text-gray-600">Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
