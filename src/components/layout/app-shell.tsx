'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

// ============================================================================
// AppShell (v5 — FIXED HEADER + BOTTOM NAV)
// ============================================================================
// ARCHITECTURE: TopHeader and BottomNav are position:fixed — they NEVER scroll.
// Only the <main> element scrolls. This is the ONLY bulletproof approach.
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
  loading: () => <div className="fixed top-0 left-0 right-0 z-50 h-[58px] glass-strong border-b border-border" />,
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

  // Reset scroll position when navigating to a new page
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
    });
  }, [pathname]);

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="h-dvh flex flex-col" dir="rtl" lang="ar">
      {/* Navigation progress bar */}
      <NavProgress />

      {/* Eagerly prefetch pages for this role → instant navigation */}
      <RolePrefetcher role={role} />

      {/* ===== FIXED TOP HEADER — never scrolls away ===== */}
      <TopHeader
        onMenuToggle={handleMenuToggle}
        role={role}
      />

      {/* ===== FIXED BOTTOM NAV (mobile) — never scrolls away ===== */}
      <div className="md:hidden">
        <BottomNav role={role} />
      </div>

      {/* ===== CONTENT AREA — positioned between fixed header and bottom nav ===== */}
      {/* On mobile: top padding = header height (~58px), bottom padding = bottom nav height (~68px) */}
      {/* On desktop: top padding = header height (~58px), no bottom nav */}
      <div className="flex-1 pt-[58px] md:pb-0 pb-[68px] min-h-0">
        {/* Desktop Sidebar */}
        <div className="hidden md:block shrink-0 fixed top-[58px] bottom-0 right-0 z-20 w-64 border-l border-border/70">
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

        {/* Main Content — the ONLY scrollable element */}
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-y-auto custom-scrollbar md:mr-64"
        >
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
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
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <PushNotificationSetup />;
}
