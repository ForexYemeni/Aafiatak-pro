'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

// ============================================================================
// Safe Provider Wrapper - Error Boundary
// ============================================================================
// Wraps providers (PWA, Socket, etc.) so that if they crash,
// the rest of the app continues to work.
// ============================================================================

interface SafeProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface SafeProviderState {
  hasError: boolean;
}

export class SafeProvider extends Component<SafeProviderProps, SafeProviderState> {
  constructor(props: SafeProviderProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SafeProviderState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeProvider] Error caught:', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
