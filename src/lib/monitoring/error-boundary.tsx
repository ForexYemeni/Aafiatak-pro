// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Error Boundary Component
// ============================================================================
// React Error Boundary that catches runtime errors, displays a user-friendly
// Arabic error message, logs the error to monitoring, and provides a retry
// button. Also includes an error reporting mechanism.
// ============================================================================

'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Send, ChevronDown } from 'lucide-react';
import { logError } from './index';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component to render on error */
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export interface ErrorBoundaryFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
  onToggleDetails: () => void;
  onRetry: () => void;
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to monitoring
    logError(error, {
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });

    // Call the optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ errorInfo });
  }

  handleToggleDetails = (): void => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            showDetails={this.state.showDetails}
            onToggleDetails={this.handleToggleDetails}
            onRetry={this.handleRetry}
          />
        );
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          showDetails={this.state.showDetails}
          onToggleDetails={this.handleToggleDetails}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Default Error Fallback Component
// ============================================================================

function DefaultErrorFallback({
  error,
  errorInfo,
  showDetails,
  onToggleDetails,
  onRetry,
}: ErrorBoundaryFallbackProps): React.ReactElement {
  const errorDetails = [
    error?.message ?? '',
    error?.stack ?? '',
    errorInfo?.componentStack ?? '',
  ].filter(Boolean).join('\n\n');

  return (
    <div
      dir="rtl"
      className="flex min-h-[400px] w-full items-center justify-center p-6"
    >
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
        {/* Error Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>

        {/* Arabic Error Message */}
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          حدث خطأ غير متوقع
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني إذا استمرت المشكلة.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>

          <button
            onClick={() => {
              const subject = encodeURIComponent('تقرير خطأ في تطبيق عافيتك');
              const body = encodeURIComponent(`التفاصيل:\n\n${errorDetails}`);
              window.open(`mailto:support@aafiatak.com?subject=${subject}&body=${body}`, '_blank');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <Send className="h-4 w-4" />
            إبلاغ عن الخطأ
          </button>
        </div>

        {/* Toggle Error Details */}
        <button
          onClick={onToggleDetails}
          className="mt-4 inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-700"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          />
          {showDetails ? 'إخفاء التفاصيل' : 'عرض تفاصيل الخطأ'}
        </button>

        {/* Error Details (Collapsible) */}
        {showDetails && (
          <div className="mt-3 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-left" dir="ltr">
            <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">
              {errorDetails}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Exported Error Boundary Component
// ============================================================================

/**
 * Error Boundary component for the عافيتك platform.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * With custom fallback:
 * ```tsx
 * <ErrorBoundary fallback={CustomErrorUI}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export function ErrorBoundary(props: ErrorBoundaryProps): React.ReactElement {
  return <ErrorBoundaryInner {...props} />;
}

export default ErrorBoundary;
