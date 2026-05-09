'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

// ============================================================================
// Auth Hydration Guard
// ============================================================================
// Waits for Zustand hydration, then checks authentication and role.
// Redirects unauthenticated / wrong-role users to the login page
// using router.replace() (client-side navigation) to avoid redirect loops.
//
// Key design decisions:
// - No localStorage fallback: Zustand is the single source of truth.
// - Uses a ref to track redirect attempts (survives re-renders).
// - 3-second safety timeout forces ready state if hydration stalls.
// - No server-side (middleware) redirects — everything is client-side.
// ============================================================================

interface AuthHydrationGuardProps {
  children: ReactNode;
  /** The role(s) required to view this page */
  requiredRoles: string[];
  /** Redirect path if not authenticated */
  redirectPath: string;
  /** Gradient background class */
  gradientClass: string;
  /** Theme color class for spinner */
  spinnerColorClass: string;
}

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

  const [isReady, setIsReady] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const redirectAttemptedRef = useRef(false);

  // Phase 1: Wait for Zustand hydration (with 3-second timeout)
  useEffect(() => {
    if (zustandHydrated) {
      setIsReady(true);
      return;
    }

    // Safety timeout: force ready after 3 seconds
    const timer = setTimeout(() => {
      setIsReady(true);
      // Also force Zustand hydration flag so the rest of the app works
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
  }, [zustandHydrated]);

  // Phase 2: Auth check and redirect (using router.replace to avoid loops)
  useEffect(() => {
    if (!isReady) return;
    if (redirectAttemptedRef.current) return;

    if (!isAuthenticated || !user) {
      // Not authenticated — redirect to login
      redirectAttemptedRef.current = true;
      router.replace(redirectPath);
      return;
    }

    if (!requiredRoles.includes(user.role)) {
      // Wrong role — redirect to login
      redirectAttemptedRef.current = true;
      router.replace(redirectPath);
      return;
    }

    // Authenticated with correct role — the guard will render children below
  }, [isReady, isAuthenticated, user, requiredRoles, redirectPath, router]);

  // Show loading spinner while not ready
  if (!isReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${gradientClass}`} dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 border-4 ${spinnerColorClass}/30 border-t-${spinnerColorClass} rounded-full animate-spin`} />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          {showRetry && (
            <button
              onClick={() => {
                // Clear any stale auth state and reload
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
