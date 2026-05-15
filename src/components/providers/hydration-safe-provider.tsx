'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';

// ============================================================================
// Hydration Safe Provider (ULTRA-FAST v2)
// ============================================================================
// Prevents React hydration mismatches by ensuring the first client render
// exactly matches the server render.
//
// PERFORMANCE FIXES (v2):
// 1. Module-level flag: Once mounted in this session, ALL subsequent renders
//    skip the hydration check entirely — no more unnecessary loading shells.
// 2. Faster detection: Uses requestAnimationFrame instead of waiting for
//    the next React render cycle.
// 3. No spinner flash on client-side navigations — only on cold SSR start.
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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Use requestAnimationFrame for faster mounting detection
    // This is faster than waiting for the next React commit
    rafRef.current = requestAnimationFrame(() => {
      _globalMounted = true;
      setHasMounted(true);
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // During SSR and initial client hydration, show a minimal shell
  // that exactly matches what the server renders
  if (!hasMounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        dir="rtl"
        lang="ar"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
