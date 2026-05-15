'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

// ============================================================================
// AppShell (v6 — SIMPLEST POSSIBLE: position:fixed for everything)
// ============================================================================
// TopHeader = fixed at top
// BottomNav = fixed at bottom
// Sidebar = fixed on the side (desktop)
// Main = fixed between header and bottom nav — THE ONLY scrollable element
// No flex, no overflow-hidden, no min-h-0 — just fixed positioning
// ============================================================================

interface AppShellProps {
  children: ReactNode;
}

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
    <div dir="rtl" lang="ar">
      {/* Navigation progress bar */}
      <NavProgress />

      {/* Eagerly prefetch pages for this role */}
      <RolePrefetcher role={role} />

      {/* ===== FIXED TOP HEADER — always visible ===== */}
      <TopHeader
        onMenuToggle={handleMenuToggle}
        role={role}
      />

      {/* ===== FIXED BOTTOM NAV (mobile) — always visible ===== */}
      <div className="md:hidden">
        <BottomNav role={role} />
      </div>

      {/* ===== DESKTOP SIDEBAR — fixed on the right side ===== */}
      <div className="hidden md:block fixed top-[58px] bottom-0 right-0 z-20 w-64 border-l border-border/70 bg-card/95 backdrop-blur-2xl">
        <Sidebar
          role={role}
          isOpen={true}
          onToggle={handleMenuToggle}
        />
      </div>

      {/* ===== MOBILE SIDEBAR OVERLAY ===== */}
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

      {/* ===== MAIN CONTENT — positioned between fixed header/footer, scrollable ===== */}
      <main
        ref={mainRef}
        className="fixed overflow-y-auto custom-scrollbar"
        style={{
          top: '58px',              // below fixed header
          bottom: '68px',           // above fixed bottom nav (mobile default)
          left: '0',
          right: '0',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="p-4 md:p-6 max-w-7xl mx-auto md:mr-64">
          {children}
        </div>
      </main>

      {/* On desktop: adjust main to have no bottom offset and sidebar offset */}
      <style>{`
        @media (min-width: 768px) {
          main.fixed {
            bottom: 0 !important;
            right: 256px !important;
          }
        }
      `}</style>

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
