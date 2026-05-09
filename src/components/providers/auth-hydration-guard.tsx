'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

// ============================================================================
// Auth Hydration Guard
// ============================================================================
// Robust loading guard that doesn't rely solely on Zustand's _hasHydrated.
// Reads directly from localStorage as a fallback to prevent the app from
// being permanently stuck on "جاري التحميل...".
// Uses router.replace() instead of window.location.href to avoid
// hard navigation redirect loops.
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

interface LocalAuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    name: string;
    role: string;
  } | null;
}

/**
 * Read auth state directly from localStorage (Zustand persist format).
 * This is a FALLBACK for when Zustand hydration fails or is slow.
 */
function readAuthFromLocalStorage(): LocalAuthState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aafiatak-auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      return {
        isAuthenticated: parsed.state.isAuthenticated ?? false,
        user: parsed.state.user ?? null,
      };
    }
  } catch {
    // Corrupted data - clear it
    try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
  }
  return null;
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
  const zustandAuth = useAuthStore((s) => s.isAuthenticated);
  const zustandUser = useAuthStore((s) => s.user);

  const [isReady, setIsReady] = useState(false);
  const [localAuth, setLocalAuth] = useState<LocalAuthState | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  // Phase 1: Try to read from localStorage immediately (synchronous)
  useEffect(() => {
    const local = readAuthFromLocalStorage();
    setLocalAuth(local);

    // If localStorage has valid auth data, we can skip the loading state
    if (local?.isAuthenticated && local.user) {
      setIsReady(true);
    }
  }, []);

  // Phase 2: Wait for Zustand hydration (with 3-second timeout)
  useEffect(() => {
    if (zustandHydrated) {
      setIsReady(true);
      return;
    }

    // Safety timeout: force ready after 3 seconds
    const timer = setTimeout(() => {
      setIsReady(true);
      // Also force Zustand hydration flag
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

  // Phase 3: Auth check and redirect (using router.replace to avoid hard navigation loops)
  useEffect(() => {
    if (!isReady || redirectAttempted) return;

    // Use Zustand state as primary, localStorage as fallback
    const isAuthenticated = zustandAuth || localAuth?.isAuthenticated || false;
    const user = zustandUser || localAuth?.user || null;

    if (!isAuthenticated || !user) {
      // Not authenticated - use router.replace instead of window.location.href
      // to prevent hard navigation redirect loops
      setRedirectAttempted(true);
      router.replace(redirectPath);
      return;
    }

    if (!requiredRoles.includes(user.role)) {
      // Wrong role - use router.replace instead of window.location.href
      setRedirectAttempted(true);
      router.replace(redirectPath);
      return;
    }
  }, [isReady, zustandAuth, zustandUser, localAuth, requiredRoles, redirectPath, router, redirectAttempted]);

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

  // Auth check using combined state
  const isAuthenticated = zustandAuth || localAuth?.isAuthenticated || false;
  const user = zustandUser || localAuth?.user || null;

  if (!isAuthenticated || !user || !requiredRoles.includes(user.role)) {
    // Return null while redirect is happening
    return null;
  }

  return <>{children}</>;
}
