'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

export default function BeneficiaryLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    // Wait for hydration before checking auth to prevent redirect loops
    if (!_hasHydrated) return;
    if (!isAuthenticated || user?.role !== 'beneficiary') {
      router.replace('/?redirect=/beneficiary');
    }
  }, [isAuthenticated, user, router, _hasHydrated]);

  // Safety timeout: if hydration takes more than 5 seconds, show retry option
  useEffect(() => {
    if (_hasHydrated) return;
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      // Force hydration to prevent permanent stuck state
      useAuthStore.setState({ _hasHydrated: true });
    }, 5000);
    return () => clearTimeout(timer);
  }, [_hasHydrated]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-beneficiary" dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-beneficiary/30 border-t-beneficiary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          {loadingTimeout && (
            <button
              onClick={() => {
                try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
                window.location.reload();
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-beneficiary/10 text-beneficiary hover:bg-beneficiary/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة التحميل
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'beneficiary') {
    return null;
  }

  return (
    <div className="bg-gradient-beneficiary min-h-screen">
      <AppShell>{children}</AppShell>
    </div>
  );
}
