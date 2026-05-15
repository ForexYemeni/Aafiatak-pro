'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';

// ============================================================================
// Hydration Safe Provider (ULTRA-FAST v3 — ZERO DELAY)
// ============================================================================
// PERFORMANCE FIXES (v3):
// 1. Module-level flag: Once mounted in this session, ALL subsequent renders
//    skip the hydration check entirely — no more unnecessary loading shells.
// 2. INSTANT mounting: Uses synchronous setState pattern instead of rAF
// 3. No spinner flash on client-side navigations — only on cold SSR start.
// 4. NO "جاري التحميل..." text that blocks the app — renders a minimal
//    transparent shell that matches server output exactly.
// ============================================================================

// Module-level cache: once the app has mounted once, it never needs
// the hydration guard again (even if this component remounts)
let _globalMounted = false;

interface HydrationSafeProviderProps {
  children: ReactNode;
}

export function HydrationSafeProvider({ children }: HydrationSafeProviderProps) {
  // If we already mounted globally, skip all checks — render children immediately
  if (_globalMounted) {
    return <>{children}</>;
  }

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // Instant mounting — no requestAnimationFrame delay
    // Using microtask (Promise.resolve) for fastest possible mount
    _globalMounted = true;
    setHasMounted(true);
  }, []);

  // During SSR and initial client hydration, show a MINIMAL shell
  // that exactly matches what the server renders — NO visible spinner
  // This prevents the "جاري التحميل..." stuck screen
  if (!hasMounted) {
    return (
      <div
        className="min-h-screen bg-background"
        dir="rtl"
        lang="ar"
        suppressHydrationWarning
      />
    );
  }

  return <>{children}</>;
}
