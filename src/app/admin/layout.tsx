'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for hydration before checking auth to prevent redirect loops
    if (!_hasHydrated) return;
    if (!isLoading && !isAuthenticated) {
      router.replace('/?redirect=/admin');
      return;
    }
    if (!isLoading && isAuthenticated && user) {
      if (user.role !== 'admin' && user.role !== 'subadmin') {
        router.replace('/?redirect=/admin');
      }
    }
  }, [isLoading, isAuthenticated, user, router, _hasHydrated]);

  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-admin" />
          <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'subadmin')) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-admin" />
          <p className="text-muted-foreground text-sm">جارٍ التحويل...</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
