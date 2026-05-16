'use client';

import { type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrationGuard } from '@/components/providers/auth-hydration-guard';
import { ErrorBoundary } from '@/lib/monitoring/error-boundary';

interface NurseLayoutProps {
  children: ReactNode;
}

export default function NurseLayout({ children }: NurseLayoutProps) {
  return (
    <AuthHydrationGuard
      requiredRoles={['nurse']}
      redirectPath="/?redirect=/nurse"
      gradientClass="bg-gradient-nurse"
      spinnerColorClass="border-nurse"
    >
      <ErrorBoundary>
        <AppShell>
          {children}
        </AppShell>
      </ErrorBoundary>
    </AuthHydrationGuard>
  );
}
