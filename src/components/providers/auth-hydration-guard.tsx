'use client';

import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

// ============================================================================
// Auth Hydration Guard (OPTIMIZED)
// ============================================================================
// Key performance improvements:
// 1. If Zustand is already hydrated on mount, renders children IMMEDIATELY
//    without any intermediate loading state (no spinner flash).
// 2. Uses module-level cache so subsequent navigations skip the guard check.
// 3. Only shows spinner on the very first hydration (cold start).
// ============================================================================

interface AuthHydrationGuardProps {
  children: ReactNode;
  requiredRoles: string[];
  redirectPath: string;
  gradientClass: string;
  spinnerColorClass: string;
}

// Module-level cache: once auth is verified for a session, we skip re-checking
// This prevents the guard from blocking on every client-side navigation
let _authVerifiedAt = 0;
const AUTH_CACHE_TTL = 60_000; // 1 minute — re-verify after this

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

  const [isReady, setIsReady] = useState(() => zustandHydrated);
  const [showRetry, setShowRetry] = useState(false);
  const redirectAttemptedRef = useRef(false);

  // Check if auth is cached (skip guard entirely)
  // Use useMemo to avoid hydration mismatch from Date.now() in render
  const authCached = useMemo(() => Date.now() - _authVerifiedAt < AUTH_CACHE_TTL, []);

  // FAST PATH: If already hydrated and auth is valid, render children immediately
  if (zustandHydrated && isAuthenticated && user && requiredRoles.includes(user.role)) {
    _authVerifiedAt = Date.now();
    return <>{children}</>;
  }

  // Phase 1: Wait for Zustand hydration (only on cold start)
  useEffect(() => {
    if (isReady) return;

    if (zustandHydrated) {
      setIsReady(true);
      return;
    }

    // Safety timeout: force ready after 3 seconds
    const timer = setTimeout(() => {
      setIsReady(true);
      useAuthStore.setState({ _hasHydrated: true });
    }, 3000);

    // Show retry button after 6 seconds
    const retryTimer = setTimeout(() => {
      setShowRetry(true);
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [zustandHydrated, isReady]);

  // Phase 2: Auth check and redirect
  useEffect(() => {
    if (!isReady) return;
    if (redirectAttemptedRef.current) return;
    if (authCached) return; // Auth was recently verified, skip

    // Don't redirect during logout — the hard navigation (window.location.href)
    // in the logout handler will handle the redirect. If we fire router.replace()
    // here, it races with the hard navigation and causes a brief error page.
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
  }, [isReady, isAuthenticated, user, requiredRoles, redirectPath, router, authCached]);

  // Show loading spinner while not ready (only on cold start)
  if (!isReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${gradientClass}`} dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 border-4 ${spinnerColorClass}/30 border-t-${spinnerColorClass} rounded-full animate-spin`} />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          {showRetry && (
            <button
              onClick={() => {
                try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
                window.location.href = '/';
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-foreground hover:bg-white/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة التحميل
            </button>
          )}
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
