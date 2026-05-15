'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

// ============================================================================
// AppShell (PERFORMANCE v4 — SCROLL FIX)
// ============================================================================
// FIXES (v4):
// 1. Reset scroll position on navigation (main ref + scrollTop = 0)
// 2. TopHeader uses flex-shrink-0 so it's NEVER compressed by flex layout
// 3. Removed sticky from TopHeader (it's a fixed flex child, not inside scroll)
// 4. h-screen + overflow-hidden on root for proper scroll container
// ============================================================================

interface AppShellProps {
  children: ReactNode;
}

// Lazy load heavy layout components for faster initial paint
const Sidebar = dynamic(() => import('./sidebar').then(mod => ({ default: mod.Sidebar })), {
  loading: () => <div className="w-64 hidden md:block" />,
});

const BottomNav = dynamic(() => import('./bottom-nav').then(mod => ({ default: mod.BottomNav })), {
  loading: () => <div className="h-16 md:hidden" />,
});

const TopHeader = dynamic(() => import('./top-header').then(mod => ({ default: mod.TopHeader })), {
  loading: () => <div className="h-14 shrink-0" />,
});

const NavProgress = dynamic(() => import('@/components/common/nav-progress').then(mod => ({ default: mod.NavProgress })), {
  ssr: false,
  loading: () => null,
});

const RolePrefetcher = dynamic(() => import('@/components/common/role-prefetcher').then(mod => ({ default: mod.RolePrefetcher })), {
  ssr: false,
  loading: () => null,
});

const PushNotificationSetup = dynamic(() => import('@/components/common/push-notification-setup').then(mod => ({ default: mod.PushNotificationSetup })), {
  ssr: false,
  loading: () => null,
});

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  const role: UserRole = user?.role ?? 'beneficiary';

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // CRITICAL FIX: Reset scroll position when navigating to a new page
  // This ensures the user always sees the top of the new page
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  // Debounced sidebar toggle
  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" dir="rtl" lang="ar">
      {/* Navigation progress bar */}
      <NavProgress />

      {/* Eagerly prefetch pages for this role → instant navigation */}
      <RolePrefetcher role={role} />

      {/* Top Header — flex-shrink-0 prevents it from being compressed */}
      <div className="shrink-0 z-30">
        <TopHeader
          onMenuToggle={handleMenuToggle}
          role={role}
        />
      </div>

      {/* Content area: Sidebar + Main — takes remaining height */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar — CSS-driven, no JS breakpoint detection */}
        <div className="hidden md:block shrink-0">
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

        {/* Main Content — scroll container with ref for scroll reset */}
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-y-auto custom-scrollbar pb-24 md:pb-6"
        >
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation — CSS-driven */}
      <div className="md:hidden shrink-0">
        <BottomNav role={role} />
      </div>

      {/* Push Notification Auto-Setup (deferred) */}
      <DeferredPushSetup />
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
