'use client';

import { type ReactNode } from 'react';

// ============================================================================
// Hydration Safe Provider (v4 — SAFE RENDER)
// ============================================================================
// FIX: v3 caused white screen because it rendered an EMPTY div during SSR
// and if client hydration failed (JS error), the app stayed blank forever.
//
// v4 approach: Simply render children directly. Next.js App Router handles
// hydration well. The 'use client' directive ensures this runs on the client.
// If any child throws during hydration, the error boundary (SafeProvider)
// will catch it and the app won't be stuck on a blank page.
//
// This component is kept as a pass-through for backward compatibility
// and can be safely removed in a future cleanup.
// ============================================================================

interface HydrationSafeProviderProps {
  children: ReactNode;
}

export function HydrationSafeProvider({ children }: HydrationSafeProviderProps) {
  // Direct render — no hydration guard, no blank screen, no loading delay
  return <>{children}</>;
}
