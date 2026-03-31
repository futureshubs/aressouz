/**
 * Error Boundary Component
 * Production-ready React error boundary with comprehensive error handling
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';
import { log } from '../utils/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  showErrorDetails?: boolean;
  enableRetry?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log the error
    log.error('React Error Boundary caught an error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    }, ['react', 'error-boundary']);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));

      log.info('Error boundary retry attempt', {
        retryCount: this.state.retryCount + 1,
        maxRetries,
      }, ['error-boundary', 'retry']);
    } else {
      log.warn('Max retries reached for error boundary', {
        retryCount: this.state.retryCount,
        maxRetries,
      }, ['error-boundary', 'retry']);
    }
  };

  handleReload = (): void => {
    log.info('Page reload triggered from error boundary', {}, ['error-boundary', 'reload']);
    window.location.reload();
  };

  handleReportError = (): void => {
    const { error, errorInfo } = this.state;
    
    if (error && errorInfo) {
      const errorReport = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        context: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          retryCount: this.state.retryCount,
        },
      };

      // Send error report to your error tracking service
      fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
      }).catch(reportError => {
        log.error('Failed to report error', { reportError }, ['error-boundary']);
      });

      log.info('Error report submitted', {}, ['error-boundary', 'report']);
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { 
      children, 
      fallback, 
      maxRetries = 3, 
      showErrorDetails = process.env.NODE_ENV === 'development',
      enableRetry = true 
    } = this.props;

    if (hasError) {
      // Custom fallback component
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 m-4">
            <div className="text-center">
              {/* Error Icon */}
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>

              {/* Error Message */}
              <p className="text-gray-600 mb-6">
                {error?.message || 'An unexpected error occurred while rendering this component.'}
              </p>

              {/* Error Details (Development Only) */}
              {showErrorDetails && error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-40">
                    <div className="mb-2">
                      <strong>Error:</strong> {error.name}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {error.message}
                    </div>
                    {error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap">{error.stack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {enableRetry && retryCount < maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    Try Again ({maxRetries - retryCount} attempts left)
                  </Button>
                )}

                <Button
                  onClick={this.handleReload}
                  className="w-full"
                  variant="outline"
                >
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleReportError}
                  className="w-full"
                  variant="ghost"
                >
                  Report Error
                </Button>
              </div>

              {/* Retry Count */}
              {retryCount >= maxRetries && (
                <p className="mt-4 text-sm text-gray-500">
                  Maximum retry attempts reached. Please reload the page or contact support if the problem persists.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Hook for functional components
export interface UseErrorBoundaryReturn {
  error: Error | null;
  resetError: () => void;
}

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error);
      log.error('Error caught by useErrorBoundary', {
        error: {
          name: event.error?.name,
          message: event.error?.message,
          stack: event.error?.stack,
        },
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }, ['use-error-boundary']);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(event.reason));
      log.error('Unhandled promise rejection caught by useErrorBoundary', {
        reason: event.reason,
        stack: event.reason?.stack,
      }, ['use-error-boundary']);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return { error, resetError };
}

// Higher-order component for wrapping components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
