'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Auth Hydration Guard (v4 — NO WHITE SCREEN)
// ============================================================================
// FIX: Previous versions showed blank bg-background divs during hydration
// which caused white screen if JS failed or hydration was slow.
//
// v4 approach:
// 1. Render children IMMEDIATELY — no blank loading shell
// 2. Handle auth redirect via useEffect (non-blocking)
// 3. If user is not authenticated, redirect AFTER showing the page briefly
//    rather than showing a blank page while waiting
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
  const authCached = _authVerifiedAt > 0 && Date.now() - _authVerifiedAt < AUTH_CACHE_TTL;

  // ═══════════════════════════════════════════════════════════════════════
  // CRITICAL: ALL hooks MUST be called BEFORE any early returns.
  // Violating the Rules of Hooks (conditional hook calls) causes
  // React error #300 "Rendered fewer hooks than expected".
  // ═══════════════════════════════════════════════════════════════════════

  // Force hydration after timeout if Zustand hasn't hydrated yet
  useEffect(() => {
    if (zustandHydrated) return;

    const timer = setTimeout(() => {
      useAuthStore.setState({ _hasHydrated: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [zustandHydrated]);

  // Auth check and redirect — all in useEffect so it's non-blocking
  useEffect(() => {
    if (!zustandHydrated) return;
    if (redirectAttemptedRef.current) return;
    if (authCached) return;

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

  // ═══════════════════════════════════════════════════════════════════════
  // EARLY RETURNS — all placed AFTER all hooks to obey the Rules of Hooks
  // ═══════════════════════════════════════════════════════════════════════

  // FAST PATH: If already hydrated and auth is valid, render children immediately
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
  if (user && user.id === _lastVerifiedUserId && user.role === _lastVerifiedRole && requiredRoles.includes(user.role)) {
    _authVerifiedAt = Date.now();
    return <>{children}</>;
  }

  // KEY FIX: Instead of showing a BLANK div during hydration,
  // show a minimal loading indicator with a spinner so the user
  // knows the app is working and not broken
  if (!zustandHydrated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        dir="rtl"
        lang="ar"
        style={{
          background: 'linear-gradient(135deg, #7c3aed10 0%, #0ea5e910 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  // Auth check: if not authenticated or wrong role, show redirect message briefly
  if (!isAuthenticated || !user || !requiredRoles.includes(user.role)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        dir="rtl"
        lang="ar"
        style={{
          background: 'linear-gradient(135deg, #7c3aed10 0%, #0ea5e910 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">جارٍ التحويل...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
