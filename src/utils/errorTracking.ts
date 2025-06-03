import React, { createContext, useContext, useEffect } from 'react';

interface ErrorTrackingConfig {
  apiKey?: string;
  environment: 'development' | 'production' | 'staging';
  userId?: string;
  userEmail?: string;
}

interface ErrorEvent {
  id: string;
  timestamp: Date;
  error: Error;
  context: any;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

class ErrorTracker {
  private config: ErrorTrackingConfig;
  private errors: ErrorEvent[] = [];
  private listeners: ((error: ErrorEvent) => void)[] = [];

  constructor(config: ErrorTrackingConfig) {
    this.config = config;
    this.setupGlobalErrorHandling();
  }

  private setupGlobalErrorHandling() {
    // Catch JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, 'high');
    });

    // Catch Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        type: 'unhandledRejection',
        reason: event.reason
      }, 'medium');
    });

    // Catch React errors via error boundary
    this.setupReactErrorBoundary();
  }

  private setupReactErrorBoundary() {
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.('React')) {
        this.captureError(new Error(args.join(' ')), {
          type: 'reactError',
          args
        }, 'high');
      }
      originalError.apply(console, args);
    };
  }

  captureError(error: Error, context: any = {}, severity: ErrorEvent['severity'] = 'medium') {
    const errorEvent: ErrorEvent = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      error,
      context: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      userId: this.config.userId,
      severity,
      resolved: false
    };

    this.errors.push(errorEvent);
    this.notifyListeners(errorEvent);

    // Send to backend in production
    if (this.config.environment === 'production') {
      this.sendToBackend(errorEvent);
    }

    // Log to console in development
    if (this.config.environment === 'development') {
      console.group(`🚨 Error Tracked - ${severity.toUpperCase()}`);
      console.error('Error:', error);
      console.log('Context:', context);
      console.log('Event ID:', errorEvent.id);
      console.groupEnd();
    }
  }

  private async sendToBackend(errorEvent: ErrorEvent) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          id: errorEvent.id,
          message: errorEvent.error.message,
          stack: errorEvent.error.stack,
          context: errorEvent.context,
          severity: errorEvent.severity,
          timestamp: errorEvent.timestamp
        })
      });
    } catch (err) {
      console.warn('Failed to send error to backend:', err);
    }
  }

  captureAPIError(endpoint: string, response: Response, requestData?: any) {
    this.captureError(new Error(`API Error: ${response.status} ${response.statusText}`), {
      type: 'apiError',
      endpoint,
      status: response.status,
      statusText: response.statusText,
      requestData
    }, response.status >= 500 ? 'high' : 'medium');
  }

  captureUserAction(action: string, data?: any) {
    // Track user actions for context in errors
    this.captureError(new Error(`User Action: ${action}`), {
      type: 'userAction',
      action,
      data
    }, 'low');
  }

  capturePerformance(metric: string, value: number, context?: any) {
    if (value > 1000) { // Flag slow operations
      this.captureError(new Error(`Performance Issue: ${metric}`), {
        type: 'performance',
        metric,
        value,
        context
      }, 'medium');
    }
  }

  getErrors(): ErrorEvent[] {
    return [...this.errors];
  }

  getErrorsByseverity(severity: ErrorEvent['severity']): ErrorEvent[] {
    return this.errors.filter(error => error.severity === severity);
  }

  markResolved(errorId: string) {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
    }
  }

  onError(callback: (error: ErrorEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners(error: ErrorEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.warn('Error in error listener:', err);
      }
    });
  }

  updateUser(userId: string, userEmail: string) {
    this.config.userId = userId;
    this.config.userEmail = userEmail;
  }

  clearErrors() {
    this.errors = [];
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker({
  environment: (process.env.NODE_ENV as any) || 'development'
});

// React Context for error tracking
const ErrorTrackingContext = createContext<ErrorTracker>(errorTracker);

export const useErrorTracking = () => {
  return useContext(ErrorTrackingContext);
};

export const ErrorTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Initialize error tracking
    console.log('🔍 Error tracking initialized');
    
    return () => {
      console.log('🔍 Error tracking cleanup');
    };
  }, []);

  return React.createElement(ErrorTrackingContext.Provider, { value: errorTracker }, children);
};

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    errorTracker.captureError(error, {
      type: 'reactErrorBoundary',
      errorInfo,
      componentStack: errorInfo.componentStack
    }, 'critical');

    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || React.createElement('div', { className: 'min-h-screen flex items-center justify-center bg-gray-50' },
        React.createElement('div', { className: 'max-w-md mx-auto text-center' },
          React.createElement('div', { className: 'text-6xl mb-4' }, '🚨'),
          React.createElement('h1', { className: 'text-2xl font-bold text-gray-900 mb-2' }, 'Oops! Something went wrong'),
          React.createElement('p', { className: 'text-gray-600 mb-4' }, 'We\'ve been notified about this error and will fix it soon.'),
          React.createElement('button', {
            onClick: () => window.location.reload(),
            className: 'bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700'
          }, 'Reload Page'),
          process.env.NODE_ENV === 'development' && React.createElement('details', { className: 'mt-4 text-left' },
            React.createElement('summary', { className: 'cursor-pointer text-sm text-gray-500' }, 'Error Details (Development)'),
            React.createElement('pre', { className: 'mt-2 text-xs bg-gray-800 text-white p-4 rounded overflow-auto' }, this.state.error?.stack)
          )
        )
      );
    }

    return this.props.children;
  }
}

export default errorTracker;