'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Loader2, RefreshCw } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, _hasHydrated } = useAuthStore();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

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

  // Safety timeout: if loading takes more than 10 seconds, show retry option
  useEffect(() => {
    if (_hasHydrated && !isLoading) return;
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [_hasHydrated, isLoading]);

  // Only show loading spinner during initial hydration
  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-admin" />
          <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
          {loadingTimeout && (
            <button
              onClick={() => {
                try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
                window.location.reload();
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-admin/10 text-admin hover:bg-admin/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة التحميل
            </button>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated or wrong role, return null (redirect is handled by useEffect)
  if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'subadmin')) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
