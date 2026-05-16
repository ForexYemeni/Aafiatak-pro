'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { _GET_CACHE_warmUp, _GET_CACHE_readSync } from '@/hooks/use-auth';
import type { UserRole } from '@/types';

// ============================================================================
// RolePrefetcher (ULTRA-FAST v2)
// ============================================================================
// PERFORMANCE FIXES:
// 1. Only prefetch the FIRST 3 most-likely pages (not all 16+)
// 2. API cache warming is deferred until browser is idle
// 3. Only warm the API for the CURRENT page + 1 likely next page
// 4. Uses requestIdleCallback to avoid blocking the main thread
// 5. Skips prefetching entirely if data is already in cache
// ============================================================================

// Priority pages — only these are prefetched immediately
// (the rest will be prefetched lazily when the user navigates)
const PRIORITY_PAGES: Record<UserRole, string[]> = {
  admin: ['/admin', '/admin/orders', '/admin/emergencies'],
  subadmin: ['/admin', '/admin/orders', '/admin/emergencies'],
  nurse: ['/nurse', '/nurse/deployments', '/nurse/earnings'],
  beneficiary: ['/beneficiary', '/beneficiary/orders', '/beneficiary/emergency'],
};

// Secondary pages — prefetched lazily after idle
const SECONDARY_PAGES: Record<UserRole, string[]> = {
  admin: [
    '/admin/nurses',
    '/admin/beneficiaries',
    '/admin/services',
    '/admin/payments',
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
    '/admin/nurses',
    '/admin/beneficiaries',
    '/admin/services',
    '/admin/payments',
    '/admin/deployments',
    '/admin/ratings',
    '/admin/chat',
    '/admin/subadmin-settings',
  ],
  nurse: [
    '/nurse/requests',
    '/nurse/my-requests',
    '/nurse/ratings',
    '/nurse/chat',
    '/nurse/profile',
    '/nurse/notifications',
    '/nurse/schedule',
  ],
  beneficiary: [
    '/beneficiary/chat',
    '/beneficiary/profile',
    '/beneficiary/loyalty',
    '/beneficiary/payments',
    '/beneficiary/notifications',
  ],
};

// ONLY warm the most critical API endpoints — not all 13+
const CRITICAL_API_ENDPOINTS: Record<UserRole, string[]> = {
  admin: [
    '/api/admin/dashboard',
  ],
  subadmin: [
    '/api/admin/dashboard',
  ],
  nurse: [
    '/api/nurse/profile',
    '/api/nurse/assignments?counts=true',
  ],
  beneficiary: [
    '/api/beneficiary/orders?page=1&limit=20',
  ],
};

// Secondary API endpoints — warmed lazily
const SECONDARY_API_ENDPOINTS: Record<UserRole, string[]> = {
  admin: [
    '/api/admin/orders?limit=5&page=1',
    '/api/admin/emergencies?page=1&limit=20&search=',
    '/api/admin/nurses?limit=3&page=1',
    '/api/admin/settings',
  ],
  subadmin: [
    '/api/admin/orders?limit=5&page=1',
    '/api/admin/emergencies?page=1&limit=20&search=',
    '/api/admin/nurses?limit=3&page=1',
  ],
  nurse: [
    '/api/deployments?page=1&limit=20&search=',
    '/api/nurse/earnings',
    '/api/nurse/ratings?limit=1',
  ],
  beneficiary: [
    '/api/notifications?limit=100',
  ],
};

interface RolePrefetcherProps {
  role: UserRole;
}

export function RolePrefetcher({ role }: RolePrefetcherProps) {
  const router = useRouter();
  const hasRunRef = useRef(false);

  // Phase 1: Prefetch ONLY the 3 most likely next pages IMMEDIATELY
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const priorityPages = PRIORITY_PAGES[role] ?? [];
    
    // Prefetch the first 3 pages immediately (these are JS bundle prefetches)
    let i = 0;
    function prefetchNext() {
      if (i >= priorityPages.length) return;
      router.prefetch(priorityPages[i]);
      i++;
      // Small delay between prefetches to avoid flooding
      setTimeout(prefetchNext, 50);
    }
    prefetchNext();
  }, [role, router]);

  // Phase 2: Warm ONLY the critical API endpoints (1-2 endpoints)
  useEffect(() => {
    const endpoints = CRITICAL_API_ENDPOINTS[role] ?? [];
    if (!endpoints.length) return;

    // Only warm if not already cached
    const uncachedEndpoints = endpoints.filter(
      (url) => !_GET_CACHE_readSync(url)
    );

    if (uncachedEndpoints.length > 0) {
      // Warm critical endpoints after 500ms (give current page time to load first)
      const timer = setTimeout(() => {
        void _GET_CACHE_warmUp(uncachedEndpoints);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [role]);

  // Phase 3: Lazily prefetch secondary pages + APIs when browser is idle
  useEffect(() => {
    const scheduleIdle = () => {
      // Use requestIdleCallback if available, otherwise setTimeout
      const idleCallback = (typeof window !== 'undefined' && 'requestIdleCallback' in window)
        ? window.requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 1000);

      const idleId = idleCallback(() => {
        // Prefetch secondary pages
        const secondaryPages = SECONDARY_PAGES[role] ?? [];
        let j = 0;
        function prefetchSecondary() {
          if (j >= secondaryPages.length) return;
          router.prefetch(secondaryPages[j]);
          j++;
          setTimeout(prefetchSecondary, 100); // Slower pace for secondary
        }
        prefetchSecondary();

        // Warm secondary API endpoints
        const secondaryEndpoints = SECONDARY_API_ENDPOINTS[role] ?? [];
        const uncachedSecondary = secondaryEndpoints.filter(
          (url) => !_GET_CACHE_readSync(url)
        );
        if (uncachedSecondary.length > 0) {
          void _GET_CACHE_warmUp(uncachedSecondary);
        }
      });

      return idleId;
    };

    // Wait 3 seconds before starting idle work (let the current page fully load first)
    const timer = setTimeout(scheduleIdle, 3000);
    return () => clearTimeout(timer);
  }, [role, router]);

  return null;
}
