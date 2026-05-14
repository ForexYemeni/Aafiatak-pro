'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types';

// All navigable pages per role — prefetched eagerly on shell mount
// so every page loads instantly regardless of device/viewport
const ROLE_PAGES: Record<UserRole, string[]> = {
  admin: [
    '/admin',
    '/admin/orders',
    '/admin/nurses',
    '/admin/beneficiaries',
    '/admin/services',
    '/admin/payments',
    '/admin/emergencies',
    '/admin/deployments',
    '/admin/ratings',
    '/admin/chat',
    '/admin/complaints',
    '/admin/coupons',
    '/admin/subadmins',
    '/admin/settings',
    '/admin/subadmin-settings',
    '/admin/activity/page',
  ],
  subadmin: [
    '/admin',
    '/admin/orders',
    '/admin/nurses',
    '/admin/beneficiaries',
    '/admin/services',
    '/admin/payments',
    '/admin/emergencies',
    '/admin/deployments',
    '/admin/ratings',
    '/admin/chat',
    '/admin/subadmin-settings',
  ],
  nurse: [
    '/nurse',
    '/nurse/requests',
    '/nurse/my-requests',
    '/nurse/deployments',
    '/nurse/ratings',
    '/nurse/chat',
    '/nurse/earnings',
    '/nurse/profile',
    '/nurse/notifications',
    '/nurse/schedule',
  ],
  beneficiary: [
    '/beneficiary',
    '/beneficiary/orders',
    '/beneficiary/emergency',
    '/beneficiary/chat',
    '/beneficiary/profile',
    '/beneficiary/loyalty',
    '/beneficiary/payments',
    '/beneficiary/notifications',
  ],
};

interface RolePrefetcherProps {
  role: UserRole;
}

/**
 * Eagerly prefetches all pages for the current user role as soon as
 * the AppShell mounts — done in a staggered fashion so it doesn't
 * block the main thread on initial render.
 */
export function RolePrefetcher({ role }: RolePrefetcherProps) {
  const router = useRouter();

  useEffect(() => {
    const pages = ROLE_PAGES[role] ?? [];
    let i = 0;

    // Stagger prefetch calls so the browser prioritises the current page first
    function prefetchNext() {
      if (i >= pages.length) return;
      router.prefetch(pages[i]);
      i++;
      // Space them out: first 3 immediately, rest every 120ms
      const delay = i <= 3 ? 0 : 120;
      setTimeout(prefetchNext, delay);
    }

    // Start after a short idle window so initial render isn't affected
    const idle = setTimeout(prefetchNext, 400);
    return () => clearTimeout(idle);
  }, [role, router]);

  return null;
}
