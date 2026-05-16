'use client';

// ============================================================================
// عافيتك (Aafiatak) - Route Prefetcher for Ultra-Fast Navigation
// ============================================================================
// Preloads the most likely next routes based on the user's role,
// making navigation feel instant. Uses Next.js router.prefetch().
// ============================================================================

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

// Routes to prefetch for each role
const ROLE_ROUTES: Record<string, string[]> = {
  admin: [
    '/admin',
    '/admin/deployments',
    '/admin/orders',
    '/admin/nurses',
    '/admin/beneficiaries',
    '/admin/emergencies',
    '/admin/payments',
    '/admin/chat',
    '/admin/settings',
    '/admin/activity',
  ],
  nurse: [
    '/nurse',
    '/nurse/deployments',
    '/nurse/requests',
    '/nurse/my-requests',
    '/nurse/earnings',
    '/nurse/chat',
    '/nurse/profile',
    '/nurse/schedule',
  ],
  beneficiary: [
    '/beneficiary',
    '/beneficiary/orders',
    '/beneficiary/request',
    '/beneficiary/chat',
    '/beneficiary/profile',
    '/beneficiary/payments',
  ],
};

export function RoutePrefetcher() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !user?.role) return;

    const routes = ROLE_ROUTES[user.role] || [];
    
    // Prefetch all role-specific routes after a short delay
    // to avoid blocking the initial page load
    const timer = setTimeout(() => {
      for (const route of routes) {
        // Don't prefetch the current page
        if (route !== pathname) {
          router.prefetch(route);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasHydrated, isAuthenticated, user?.role, pathname, router]);

  return null;
}
