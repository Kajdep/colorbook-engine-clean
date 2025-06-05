import React, { useState } from 'react';
import { X, CreditCard, Check, Star, Zap, Crown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlanFeatures {
  [key: string]: boolean;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    priceId: null,
    icon: Star,
    color: 'from-gray-500 to-gray-600',
    features: {
      'Basic story generation': true,
      'Basic drawing tools': true,
      'PDF export': true,
      'KDP compliance check': true,
      '5 projects maximum': true,
      'Community support': true,
      'Advanced AI models': false,
      'Unlimited projects': false,
      'Priority support': false,
      'Custom branding': false,
      'Team collaboration': false,
      'White-label options': false,
    } as PlanFeatures
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
      'Basic story generation': true,
      'Basic drawing tools': true,
      'PDF export': true,
      'KDP compliance check': true,
      '5 projects maximum': false,
      'Community support': true,
      'Advanced AI models': true,
      'Unlimited projects': true,
      'Priority support': true,
      'Custom branding': false,
      'Team collaboration': false,
      'White-label options': false,
    } as PlanFeatures
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    period: 'month',
    priceId: process.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || '',
    icon: Crown,
    color: 'from-purple-600 to-pink-600',
    features: {
      'Basic story generation': true,
      'Basic drawing tools': true,
      'PDF export': true,
      'KDP compliance check': true,
      '5 projects maximum': false,
      'Community support': true,
      'Advanced AI models': true,
      'Unlimited projects': true,
      'Priority support': true,
      'Custom branding': true,
      'Team collaboration': true,
      'White-label options': true,
    } as PlanFeatures
  }
];

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [isProcessing, setIsProcessing] = useState(false);

  const { user, addNotification, updateUser } = useAppStore();

  if (!isOpen) return null;

  const selectedPlanData = plans.find(p => p.id === selectedPlan);

  const handleSubscribe = async () => {
    if (selectedPlan === 'free') {
      // Free plan - just update user subscription
      try {
        await updateUser({
          subscription: {
            tier: 'free',
            status: 'active'
          }
        });

        addNotification({
          type: 'success',
          message: 'Welcome to ColorBook Engine Free plan!'
        });

        onClose();
      } catch (error) {
        addNotification({
          type: 'error',
          message: 'Failed to update subscription'
        });
      }
      return;
    }

    setIsProcessing(true);

    try {
      const plan = plans.find(p => p.id === selectedPlan);
      if (!plan?.priceId) {
        throw new Error('Invalid plan configuration');
      }

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${window.location.origin}/subscription/success`,
          cancelUrl: `${window.location.origin}/subscription`,
          metadata: { planId: plan.id }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      const url = data.sessionUrl || data.url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('Invalid session response');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      addNotification({
        type: 'error',
        message: 'Failed to start checkout session'
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CreditCard className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Choose Your Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Plan Selection */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedPlan === plan.id;
              const currentUserTier = user?.subscription?.tier;
              const isCurrentPlan = currentUserTier === plan.id;
              
              return (
                <div
                  key={plan.id}
                  className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'border-blue-500 shadow-lg transform -translate-y-1' 
                      : 'border-gray-200 hover:border-gray-300'
                  } ${plan.popular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className={`w-12 h-12 bg-gradient-to-r ${plan.color} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon size={24} className="text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-500">/{plan.period}</span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(plan.features).map(([feature, included]) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          included ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {included ? (
                            <Check size={12} className="text-green-600" />
                          ) : (
                            <X size={12} className="text-gray-400" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          included ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>



          {/* Summary and Subscribe Button */}
          <div className="mt-8 flex items-center justify-between">
            <div className="flex-1">
              {selectedPlanData && (
                <div className="text-lg font-semibold text-gray-900">
                  Total: ${selectedPlanData.price}/{selectedPlanData.period}
                  {selectedPlanData.price > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      Billed {selectedPlanData.period}ly • Cancel anytime
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-colors ${
                selectedPlan === 'free'
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              {isProcessing ? (
                <>
                  <div className="spinner" />
                  Processing...
                </>
              ) : (
                <>
                  {selectedPlan === 'free' ? 'Get Started' : 'Subscribe Now'}
                </>
              )}
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center text-sm text-gray-500">
            🔒 Your payment information is secure and encrypted.
            {selectedPlan !== 'free' && (
              <div className="mt-1">30-day money-back guarantee • No setup fees</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
