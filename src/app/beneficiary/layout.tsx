'use client';

import { type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrationGuard } from '@/components/providers/auth-hydration-guard';
import { ErrorBoundary } from '@/lib/monitoring/error-boundary';

export default function BeneficiaryLayout({ children }: { children: ReactNode }) {
  return (
    <AuthHydrationGuard
      requiredRoles={['beneficiary']}
      redirectPath="/?redirect=/beneficiary"
      gradientClass="bg-gradient-beneficiary"
      spinnerColorClass="border-beneficiary"
    >
      <ErrorBoundary>
        <div className="bg-gradient-beneficiary h-full overflow-hidden">
          <AppShell>{children}</AppShell>
        </div>
      </ErrorBoundary>
    </AuthHydrationGuard>
  );
}
