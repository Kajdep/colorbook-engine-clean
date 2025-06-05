import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, LogIn, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  name?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<AuthFormData>>({});

  const { addNotification, login, register } = useAppStore();

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: Partial<AuthFormData> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'register') {
      if (!formData.name || formData.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        addNotification({ 
          type: 'success', 
          message: 'Welcome back! Successfully logged in.' 
        });
      } else {
        await register(formData.email, formData.name!, formData.password);
        addNotification({ 
          type: 'success', 
          message: 'Account created successfully! Welcome to ColorBook Engine.' 
        });
      }
      
      onClose();
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        name: ''
      });
      setErrors({});
      
    } catch (error: any) {
      addNotification({ 
        type: 'error', 
        message: error.message || `${mode === 'login' ? 'Login' : 'Registration'} failed. Please try again.` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof AuthFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {mode === 'login' ? (
              <LogIn className="text-blue-600" size={24} />
            ) : (
              <UserPlus className="text-purple-600" size={24} />
            )}
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`form-input pl-10 ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`form-input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="Enter your email"
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`form-input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword || ''}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={`form-input pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              mode === 'login'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-purple-600 hover:bg-purple-700'
            } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <>
                {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="p-6 bg-gray-50 rounded-b-xl border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={switchMode}
              className={`ml-2 font-medium ${
                mode === 'login' ? 'text-purple-600 hover:text-purple-700' : 'text-blue-600 hover:text-blue-700'
              } transition-colors`}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          
          {mode === 'register' && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;