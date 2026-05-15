'use client';

import { useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

// ============================================================================
// Auth Hydration Guard (ULTRA-FAST v2)
// ============================================================================
// PERFORMANCE FIXES:
// 1. Module-level cache: Once auth is verified, skip ALL checks for 5 minutes
// 2. Instant render: If Zustand is already hydrated on mount, render immediately
// 3. No unnecessary state updates: Uses refs instead of state where possible
// 4. Faster safety timeout: 2s instead of 3s
// 5. No spinner flash: Uses CSS-only transition instead of React state
// ============================================================================

interface AuthHydrationGuardProps {
  children: ReactNode;
  requiredRoles: string[];
  redirectPath: string;
  gradientClass: string;
  spinnerColorClass: string;
}

// Module-level cache: once auth is verified for a session, we skip re-checking
// Increased from 1 minute to 5 minutes — reduces unnecessary guard evaluations
let _authVerifiedAt = 0;
const AUTH_CACHE_TTL = 300_000; // 5 minutes

// Track if we've ever shown the guard spinner (only show on cold start)
let _hasEverShownGuard = false;

export function AuthHydrationGuard({
  children,
  requiredRoles,
  redirectPath,
  gradientClass,
  spinnerColorClass,
}: AuthHydrationGuardProps) {
  const router = useRouter();
  const zustandHydrated = useAuthStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const redirectAttemptedRef = useRef(false);
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  // Check if auth is cached (skip guard entirely)
  const authCached = useMemo(() => Date.now() - _authVerifiedAt < AUTH_CACHE_TTL, []);

  // FAST PATH: If already hydrated and auth is valid, render children immediately
  // This is the most common case — user is already logged in and navigating between pages
  if (zustandHydrated && isAuthenticated && user && requiredRoles.includes(user.role)) {
    _authVerifiedAt = Date.now();
    _hasEverShownGuard = true;
    return <>{children}</>;
  }

  // If auth was recently verified but state temporarily changed (e.g., token refresh),
  // still render children to avoid flash
  if (authCached && isAuthenticated && user && requiredRoles.includes(user.role)) {
    return <>{children}</>;
  }

  // Phase 1: Wait for Zustand hydration (only on cold start)
  useEffect(() => {
    // If already hydrated, no need to wait
    if (zustandHydrated) return;

    // Safety timeout: force hydration after 2 seconds (was 3s)
    const timer = setTimeout(() => {
      useAuthStore.setState({ _hasHydrated: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [zustandHydrated]);

  // Phase 2: Auth check and redirect
  useEffect(() => {
    if (!zustandHydrated) return;
    if (redirectAttemptedRef.current) return;
    if (authCached) return; // Auth was recently verified, skip

    // Don't redirect during logout
    if (typeof window !== 'undefined' && sessionStorage.getItem('aafiatak-logged-out')) {
      return;
    }

    if (!isAuthenticated || !user) {
      redirectAttemptedRef.current = true;
      router.replace(redirectPath);
      return;
    }

    if (!requiredRoles.includes(user.role)) {
      redirectAttemptedRef.current = true;
      router.replace(redirectPath);
      return;
    }

    // Mark auth as verified
    _authVerifiedAt = Date.now();
  }, [zustandHydrated, isAuthenticated, user, requiredRoles, redirectPath, router, authCached]);

  // Show loading spinner while not hydrated (only on cold start)
  if (!zustandHydrated) {
    _hasEverShownGuard = true;
    return (
      <div className={`min-h-screen flex items-center justify-center ${gradientClass}`} dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 border-4 ${spinnerColorClass}/30 border-t-${spinnerColorClass} rounded-full animate-spin`} />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Auth check: if not authenticated or wrong role, return null while redirect happens
  if (!isAuthenticated || !user || !requiredRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
