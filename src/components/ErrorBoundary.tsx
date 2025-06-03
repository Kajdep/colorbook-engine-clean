import React, { ErrorInfo } from 'react';
import { useAppStore } from '../store/useAppStore';

// Enhanced error boundary with detailed logging
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

declare global {
  interface Window {
    Sentry?: any;
    LogRocket?: any;
  }
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: useAppStore.getState().user?.id,
    };

    // Send to error tracking service
    this.reportError(errorData);
    
    this.setState({ errorInfo });
  }

  private async reportError(errorData: any) {
    try {
      // Send to multiple error tracking services
      await Promise.allSettled([
        this.sendToSentry(errorData),
        this.sendToLogRocket(errorData),
        this.sendToCustomEndpoint(errorData)
      ]);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private async sendToSentry(errorData: any) {
    // Sentry integration
    if (window.Sentry) {
      window.Sentry.captureException(errorData.error, {
        extra: errorData,
        tags: {
          component: 'ErrorBoundary',
          errorId: errorData.errorId
        }
      });
    }
  }

  private async sendToLogRocket(errorData: any) {
    // LogRocket integration
    if (window.LogRocket) {
      window.LogRocket.captureException(errorData.error);
    }
  }

  private async sendToCustomEndpoint(errorData: any) {
    // Send to our backend error tracking
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      });
    } catch (error) {
      // Silently fail if backend is down
      console.warn('Backend error reporting failed:', error);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="text-red-500 text-6xl mb-4">💥</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600">
                We're sorry for the inconvenience. The error has been reported to our team.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-600">
                <strong>Error ID:</strong> {this.state.errorId}
              </div>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Technical Details (Dev Mode)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>

            <div className="mt-4 text-center">
              <a 
                href={`mailto:support@colorbookengine.com?subject=Error Report&body=Error ID: ${this.state.errorId}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;