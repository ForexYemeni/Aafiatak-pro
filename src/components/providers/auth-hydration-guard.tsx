'use client';

import { useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Auth Hydration Guard (ULTRA-FAST v3 — INSTANT NAVIGATION)
// ============================================================================
// PERFORMANCE FIXES (v3):
// 1. Module-level cache: Once auth is verified, skip ALL checks for 5 minutes
// 2. INSTANT render: If Zustand is hydrated + valid auth → render immediately
// 3. No loading spinner flash: Uses transparent placeholder instead of spinner
// 4. Faster safety timeout: 1.5s instead of 2s
// 5. Pre-verified path: No re-render after first successful verification
// ============================================================================

interface AuthHydrationGuardProps {
  children: ReactNode;
  requiredRoles: string[];
  redirectPath: string;
  gradientClass: string;
  spinnerColorClass: string;
}

// Module-level cache: once auth is verified for a session, we skip re-checking
let _authVerifiedAt = 0;
const AUTH_CACHE_TTL = 300_000; // 5 minutes

// Track the last verified user ID + role to avoid flash on same-user navigation
let _lastVerifiedUserId = '';
let _lastVerifiedRole = '';

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

  // Check if auth is cached (skip guard entirely)
  const authCached = useMemo(() => Date.now() - _authVerifiedAt < AUTH_CACHE_TTL, []);

  // FAST PATH: If already hydrated and auth is valid, render children immediately
  // This is the most common case — user is already logged in and navigating between pages
  if (zustandHydrated && isAuthenticated && user && requiredRoles.includes(user.role)) {
    _authVerifiedAt = Date.now();
    _lastVerifiedUserId = user.id;
    _lastVerifiedRole = user.role;
    return <>{children}</>;
  }

  // If auth was recently verified but state temporarily changed (e.g., token refresh),
  // still render children to avoid flash
  if (authCached && isAuthenticated && user && requiredRoles.includes(user.role)) {
    return <>{children}</>;
  }

  // If the same user was verified recently, allow immediate render
  // (prevents flash when Zustand re-hydrates from localStorage)
  if (user && user.id === _lastVerifiedUserId && user.role === _lastVerifiedRole && requiredRoles.includes(user.role)) {
    _authVerifiedAt = Date.now();
    return <>{children}</>;
  }

  // Phase 1: Wait for Zustand hydration (only on cold start)
  useEffect(() => {
    // If already hydrated, no need to wait
    if (zustandHydrated) return;

    // Safety timeout: force hydration after 1.5 seconds (was 2s)
    const timer = setTimeout(() => {
      useAuthStore.setState({ _hasHydrated: true });
    }, 1500);

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
    _lastVerifiedUserId = user.id;
    _lastVerifiedRole = user.role;
  }, [zustandHydrated, isAuthenticated, user, requiredRoles, redirectPath, router, authCached]);

  // Show MINIMAL loading shell while not hydrated (NO visible spinner text)
  // This prevents the "جاري التحميل..." stuck screen
  if (!zustandHydrated) {
    return (
      <div className={`min-h-screen ${gradientClass}`} dir="rtl" lang="ar" />
    );
  }

  // Auth check: if not authenticated or wrong role, return null while redirect happens
  if (!isAuthenticated || !user || !requiredRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
