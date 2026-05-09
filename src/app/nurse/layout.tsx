'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { RefreshCw } from 'lucide-react';

interface NurseLayoutProps {
  children: ReactNode;
}

export default function NurseLayout({ children }: NurseLayoutProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    // Wait for hydration before checking auth to prevent redirect loops
    if (!_hasHydrated) return;
    if (!isAuthenticated || user?.role !== 'nurse') {
      // Use window.location.href for reliable redirect with cookie
      window.location.href = '/?redirect=/nurse';
    }
  }, [isAuthenticated, user, _hasHydrated]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-nurse" dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-nurse/30 border-t-nurse rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          {loadingTimeout && (
            <button
              onClick={() => {
                try { localStorage.removeItem('aafiatak-auth-storage'); } catch {}
                window.location.reload();
              }}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-nurse/10 text-nurse hover:bg-nurse/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة التحميل
            </button>
          )}
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
