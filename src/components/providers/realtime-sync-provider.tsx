'use client';

import { type ReactNode } from 'react';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

/**
 * Provider that activates the real-time sync hook at the app root.
 * This ensures socket events automatically invalidate React Query cache
 * for all components throughout the app.
 */
export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  // Activate the real-time sync hook
  useRealtimeSync();
  
  return <>{children}</>;
}
