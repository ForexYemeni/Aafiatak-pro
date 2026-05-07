'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';

interface NurseLayoutProps {
  children: ReactNode;
}

export default function NurseLayout({ children }: NurseLayoutProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    // Wait for hydration before checking auth to prevent redirect loops
    if (!_hasHydrated) return;
    if (!isLoading && (!isAuthenticated || user?.role !== 'nurse')) {
      router.replace('/?redirect=/nurse');
    }
  }, [isAuthenticated, isLoading, user, router, _hasHydrated]);

  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-nurse" dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-nurse/30 border-t-nurse rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'nurse') {
    return null;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
