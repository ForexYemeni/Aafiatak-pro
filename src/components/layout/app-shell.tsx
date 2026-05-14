'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { TopHeader } from './top-header';
import { NavProgress } from '@/components/common/nav-progress';
import { RolePrefetcher } from '@/components/common/role-prefetcher';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PushNotificationSetup } from '@/components/common/push-notification-setup';
import type { UserRole } from '@/types';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  const role: UserRole = user?.role ?? 'beneficiary';

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" lang="ar">
      {/* Navigation progress bar */}
      <NavProgress />

      {/* Eagerly prefetch all pages for this role → instant navigation */}
      <RolePrefetcher role={role} />

      {/* Push Notification Auto-Setup */}
      <PushNotificationSetup />

      {/* Top Header */}
      <TopHeader
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        role={role}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar — CSS-driven, no JS breakpoint detection */}
        <div className="hidden md:block">
          <Sidebar
            role={role}
            isOpen={true}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-72 md:hidden animate-in slide-in-from-right duration-200">
              <div className="h-full">
                <Sidebar
                  role={role}
                  isOpen={true}
                  onToggle={() => setSidebarOpen(false)}
                />
              </div>
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-6">
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
