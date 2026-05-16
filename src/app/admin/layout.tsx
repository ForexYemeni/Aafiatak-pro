'use client';

import { type ReactNode, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrationGuard } from '@/components/providers/auth-hydration-guard';

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Emergency backup page is standalone — no auth guard, no app shell
  const isEmergencyBackup = pathname === '/admin/emergency-backup' && searchParams.has('token');

  if (isEmergencyBackup) {
    return <>{children}</>;
  }

  return (
    <AuthHydrationGuard
      requiredRoles={['admin', 'subadmin']}
      redirectPath="/?redirect=/admin"
      gradientClass="bg-background"
      spinnerColorClass="border-admin"
    >
      <AppShell>{children}</AppShell>
    </AuthHydrationGuard>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
