'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { _GET_CACHE_warmUp } from '@/hooks/use-auth';
import type { UserRole } from '@/types';

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
    '/admin/activity',
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

// API endpoints to pre-warm per role — maps to the main data each page needs
const ROLE_API_ENDPOINTS: Record<UserRole, string[]> = {
  admin: [
    '/api/admin/dashboard',
    '/api/admin/orders?page=1&limit=20',
    '/api/admin/nurses?page=1&limit=20',
    '/api/admin/beneficiaries?page=1&limit=20',
    '/api/admin/services',
    '/api/admin/payments?page=1&limit=20',
    '/api/admin/emergencies?page=1&limit=20',
    '/api/admin/deployments?page=1&limit=20',
    '/api/admin/ratings?page=1&limit=20',
    '/api/admin/complaints?page=1&limit=20',
    '/api/admin/coupons',
  ],
  subadmin: [
    '/api/admin/dashboard',
    '/api/admin/orders?page=1&limit=20',
    '/api/admin/nurses?page=1&limit=20',
    '/api/admin/beneficiaries?page=1&limit=20',
    '/api/admin/services',
    '/api/admin/payments?page=1&limit=20',
    '/api/admin/emergencies?page=1&limit=20',
    '/api/admin/deployments?page=1&limit=20',
  ],
  nurse: [
    '/api/nurse/dashboard',
    '/api/nurse/requests?page=1&limit=20',
    '/api/nurse/my-requests?page=1&limit=20',
    '/api/nurse/deployments?page=1&limit=20',
    '/api/nurse/ratings?page=1&limit=20',
    '/api/nurse/earnings',
    '/api/nurse/notifications?page=1&limit=20',
    '/api/nurse/schedule',
  ],
  beneficiary: [
    '/api/beneficiary/dashboard',
    '/api/beneficiary/orders?page=1&limit=20',
    '/api/beneficiary/notifications?page=1&limit=20',
  ],
};

interface RolePrefetcherProps {
  role: UserRole;
}

/**
 * Eagerly prefetches:
 * 1. All page bundles (JS) for fast route transitions
 * 2. All main API endpoints to warm up the in-memory GET cache
 *    so every page shows data instantly without waiting for the server.
 */
export function RolePrefetcher({ role }: RolePrefetcherProps) {
  const router = useRouter();

  useEffect(() => {
    const pages = ROLE_PAGES[role] ?? [];
    let i = 0;

    function prefetchNext() {
      if (i >= pages.length) return;
      router.prefetch(pages[i]);
      i++;
      const delay = i <= 3 ? 0 : 120;
      setTimeout(prefetchNext, delay);
    }

    const idle = setTimeout(prefetchNext, 400);
    return () => clearTimeout(idle);
  }, [role, router]);

  // Pre-warm API data cache after a short delay so the current page loads first
  useEffect(() => {
    const endpoints = ROLE_API_ENDPOINTS[role] ?? [];
    if (!endpoints.length) return;

    const timer = setTimeout(() => {
      void _GET_CACHE_warmUp(endpoints);
    }, 1500);

    return () => clearTimeout(timer);
  }, [role]);

  return null;
}
