'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

// ============================================================================
// Safe Provider Wrapper - Error Boundary with AUTO-RECOVERY (v2)
// ============================================================================
// CRITICAL FIX: Previous version rendered `null` permanently on error,
// which KILLED all notification components forever. Users had to manually
// click "retry" to recover, but many didn't understand that.
//
// v2 approach: Auto-retry after a delay. If the error persists, keep
// retrying with exponential backoff up to 3 attempts, then show a
// minimal recovery button. This ensures notifications keep working
// even after transient errors.
// ============================================================================

interface SafeProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface SafeProviderState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRecovering: boolean;
}

const MAX_AUTO_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // 2 seconds base, doubles each retry

export class SafeProvider extends Component<SafeProviderProps, SafeProviderState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: SafeProviderProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, isRecovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<SafeProviderState> {
    return { hasError: true, error, isRecovering: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeProvider] Error caught:', error.message, errorInfo.componentStack);

    // Auto-retry with exponential backoff
    if (this.state.retryCount < MAX_AUTO_RETRIES) {
      const delay = BASE_RETRY_DELAY * Math.pow(2, this.state.retryCount);
      console.log(`[SafeProvider] Auto-retry ${this.state.retryCount + 1}/${MAX_AUTO_RETRIES} in ${delay}ms`);

      this.retryTimer = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
          isRecovering: true,
        }));
      }, delay);
    }
  }

  handleManualRetry = () => {
    // Clear any pending auto-retry
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      isRecovering: true,
    });
  };

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  render() {
    if (this.state.hasError) {
      // If we've exhausted auto-retries, show a minimal recovery UI
      if (this.state.retryCount >= MAX_AUTO_RETRIES) {
        return (
          this.props.fallback ?? (
            <div
              dir="rtl"
              style={{
                position: 'fixed',
                bottom: '16px',
                left: '16px',
                right: '16px',
                zIndex: 9999,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <span style={{ fontSize: '13px', color: '#991b1b' }}>
                حدث خطأ في نظام الإشعارات
              </span>
              <button
                onClick={this.handleManualRetry}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                إعادة المحاولة
              </button>
            </div>
          )
        );
      }

      // Still auto-retrying - render nothing briefly
      return null;
    }

    return this.props.children;
  }
}
