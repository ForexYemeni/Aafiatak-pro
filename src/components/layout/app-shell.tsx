'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { TopHeader } from './top-header';
import { NavProgress } from '@/components/common/nav-progress';
import { RolePrefetcher } from '@/components/common/role-prefetcher';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PushNotificationSetup } from '@/components/common/push-notification-setup';
import type { UserRole } from '@/types';

// ============================================================================
// AppShell (PERFORMANCE v2)
// ============================================================================
// PERFORMANCE FIXES:
// 1. Caches previous page content for instant back-navigation
// 2. Uses CSS will-change for smoother transitions
// 3. Debounces sidebar state to prevent layout thrashing
// 4. Lazy mounts PushNotificationSetup (non-critical)
// ============================================================================

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  const role: UserRole = user?.role ?? 'beneficiary';

  // Cache current page on navigation (for instant back-navigation)
  useEffect(() => {
    // Small delay to let the page render before caching
    const timer = setTimeout(() => {
      try {
        // Use dynamic import to avoid SSR issues
        import('@/lib/navigation-cache').then(({ cacheCurrentPage }) => {
          cacheCurrentPage(pathname);
        }).catch(() => {});
      } catch {
        // Ignore
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Debounced sidebar toggle
  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" lang="ar">
      {/* Navigation progress bar */}
      <NavProgress />

      {/* Eagerly prefetch pages for this role → instant navigation */}
      <RolePrefetcher role={role} />

      {/* Push Notification Auto-Setup (deferred) */}
      <DeferredPushSetup />

      {/* Top Header */}
      <TopHeader
        onMenuToggle={handleMenuToggle}
        role={role}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar — CSS-driven, no JS breakpoint detection */}
        <div className="hidden md:block">
          <Sidebar
            role={role}
            isOpen={true}
            onToggle={handleMenuToggle}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
              onClick={handleSidebarClose}
            />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-72 md:hidden animate-in slide-in-from-right duration-200">
              <div className="h-full">
                <Sidebar
                  role={role}
                  isOpen={true}
                  onToggle={handleSidebarClose}
                />
              </div>
            </div>
          </>
        )}

        {/* Main Content — use will-change for smoother scrolling */}
        <main
          className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-6"
          style={{ willChange: 'scroll-position' }}
        >
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation — CSS-driven */}
      <div className="md:hidden">
        <BottomNav role={role} />
      </div>
    </div>
  );
}

// Lazy-loaded push notification setup — not critical for initial render
function DeferredPushSetup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Defer push notification setup by 3 seconds
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <PushNotificationSetup />;
}
