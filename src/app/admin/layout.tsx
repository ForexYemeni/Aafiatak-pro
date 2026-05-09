'use client';

import { type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrationGuard } from '@/components/providers/auth-hydration-guard';

export default function AdminLayout({ children }: { children: ReactNode }) {
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
