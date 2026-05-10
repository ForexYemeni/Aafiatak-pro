'use client';

import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { TopHeader } from './top-header';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PushNotificationSetup } from '@/components/common/push-notification-setup';
import type { UserRole } from '@/types';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  const role: UserRole = user?.role ?? 'beneficiary';

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" lang="ar">
      {/* Push Notification Auto-Setup */}
      <PushNotificationSetup />

      {/* Top Header */}
      <TopHeader
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        role={role}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar
            role={role}
            isOpen={true}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}

        {/* Mobile Sidebar Overlay - CSS transitions instead of framer-motion */}
        {isMobile && sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-80 animate-in slide-in-from-right duration-200">
              <Sidebar
                role={role}
                isOpen={true}
                onToggle={() => setSidebarOpen(false)}
              />
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar pb-20 md:pb-0">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav role={role} />}
    </div>
  );
}
