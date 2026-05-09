'use client';

import { type ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthHydrationGuard } from '@/components/providers/auth-hydration-guard';

export default function BeneficiaryLayout({ children }: { children: ReactNode }) {
  return (
    <AuthHydrationGuard
      requiredRoles={['beneficiary']}
      redirectPath="/?redirect=/beneficiary"
      gradientClass="bg-gradient-beneficiary"
      spinnerColorClass="border-beneficiary"
    >
      <div className="bg-gradient-beneficiary min-h-screen">
        <AppShell>{children}</AppShell>
      </div>
    </AuthHydrationGuard>
  );
}
