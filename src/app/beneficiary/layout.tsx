'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { FloatingChatBubble } from '@/components/common/floating-chat-bubble';

export default function BeneficiaryLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for hydration before checking auth to prevent redirect loops
    if (!_hasHydrated) return;
    if (!isLoading && (!isAuthenticated || user?.role !== 'beneficiary')) {
      router.replace('/?redirect=/beneficiary');
    }
  }, [isAuthenticated, isLoading, user, router, _hasHydrated]);

  if (!_hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-beneficiary" dir="rtl" lang="ar">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-beneficiary/30 border-t-beneficiary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
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
      <FloatingChatBubble onClick={() => router.push('/beneficiary/chat')} />
    </div>
  );
}
