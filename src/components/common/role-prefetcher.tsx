'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

// Exact URLs that match each page's initial useEffect fetch calls
const ROLE_API_ENDPOINTS: Record<UserRole, string[]> = {
  admin: [
    // admin/page.tsx — fetchDashboard parallel calls
    '/api/admin/dashboard',
    '/api/admin/orders?limit=5&page=1',
    '/api/admin/nurses?limit=3&page=1',
    '/api/admin/beneficiaries?limit=3&page=1',
    // admin/orders/page.tsx — fetchOrders(page=1, search='', statusTab='all')
    '/api/admin/orders?page=1&limit=20&search=',
    // admin/emergencies/page.tsx initial fetch
    '/api/admin/emergencies?page=1&limit=20&search=',
    // admin/deployments/page.tsx
    '/api/deployments?page=1&limit=20&search=',
    '/api/admin/settings',
    // admin/nurses/page.tsx
    '/api/admin/nurses?page=1&limit=20&search=',
    // admin/beneficiaries/page.tsx
    '/api/admin/beneficiaries?page=1&limit=20&search=',
    // admin/payments/page.tsx
    '/api/admin/payments?page=1&limit=20&search=',
    // admin/ratings
    '/api/admin/ratings?page=1&limit=20',
    // admin/coupons
    '/api/admin/coupons',
  ],
  subadmin: [
    '/api/admin/dashboard',
    '/api/admin/orders?limit=5&page=1',
    '/api/admin/orders?page=1&limit=20&search=',
    '/api/admin/emergencies?page=1&limit=20&search=',
    '/api/admin/nurses?page=1&limit=20&search=',
    '/api/admin/beneficiaries?page=1&limit=20&search=',
    '/api/deployments?page=1&limit=20&search=',
    '/api/admin/settings',
  ],
  nurse: [
    // nurse/page.tsx
    '/api/nurse/profile',
    '/api/nurse/assignments?counts=true',
    '/api/nurse/assignments?status=pending&limit=50',
    // nurse/deployments/page.tsx
    '/api/deployments?page=1&limit=20&search=',
    '/api/settings/pricing',
    // nurse/earnings/page.tsx
    '/api/nurse/earnings',
    // nurse/notifications/page.tsx
    '/api/notifications?limit=100',
    // nurse/ratings/page.tsx
    '/api/nurse/ratings?limit=1',
  ],
  beneficiary: [
    '/api/beneficiary/orders?page=1&limit=20',
    '/api/notifications?limit=100',
  ],
};

interface RolePrefetcherProps {
  role: UserRole;
}

export function RolePrefetcher({ role }: RolePrefetcherProps) {
  const router = useRouter();

  // Prefetch JS bundles — staggered so current page isn't blocked
  useEffect(() => {
    const pages = ROLE_PAGES[role] ?? [];
    let i = 0;

    function prefetchNext() {
      if (i >= pages.length) return;
      router.prefetch(pages[i]);
      i++;
      setTimeout(prefetchNext, i <= 3 ? 0 : 80);
    }

    const idle = setTimeout(prefetchNext, 300);
    return () => clearTimeout(idle);
  }, [role, router]);

  // Pre-warm API data cache immediately so pages load without skeleton
  useEffect(() => {
    const endpoints = ROLE_API_ENDPOINTS[role] ?? [];
    if (!endpoints.length) return;

    // Start right away — no big delay — so cache is ready before user navigates
    const timer = setTimeout(() => {
      void _GET_CACHE_warmUp(endpoints);
    }, 800);

    return () => clearTimeout(timer);
  }, [role]);

  return null;
}
