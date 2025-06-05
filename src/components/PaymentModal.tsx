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
    priceId: '',
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
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || '',
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
    priceId: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID || '',
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });

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
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          priceId: selectedPlanData?.priceId,
          successUrl: `${window.location.origin}/payment/success`,
          cancelUrl: `${window.location.origin}/payment/cancel`,
          metadata: { plan: selectedPlan }
        })
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Payment failed. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 3) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
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

          {/* Payment Form */}
          {selectedPlan !== 'free' && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
              
              {/* Payment Method Selection */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 border-2 rounded-lg p-4 flex items-center gap-3 transition-colors ${
                    paymentMethod === 'card' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard size={20} />
                  <span className="font-medium">Credit Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`flex-1 border-2 rounded-lg p-4 flex items-center gap-3 transition-colors ${
                    paymentMethod === 'paypal' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-5 h-5 bg-blue-600 rounded"></div>
                  <span className="font-medium">PayPal</span>
                </button>
              </div>

              {paymentMethod === 'card' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, name: e.target.value }))}
                      className="form-input"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails(prev => ({ 
                        ...prev, 
                        number: formatCardNumber(e.target.value) 
                      }))}
                      className="form-input"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={cardDetails.expiry}
                      onChange={(e) => setCardDetails(prev => ({ 
                        ...prev, 
                        expiry: formatExpiry(e.target.value) 
                      }))}
                      className="form-input"
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      value={cardDetails.cvc}
                      onChange={(e) => setCardDetails(prev => ({ 
                        ...prev, 
                        cvc: e.target.value.replace(/\D/g, '').slice(0, 4) 
                      }))}
                      className="form-input"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'paypal' && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">You will be redirected to PayPal to complete your payment.</p>
                  <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-white font-bold text-lg">PP</span>
                  </div>
                </div>
              )}
            </div>
          )}

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
