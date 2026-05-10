'use client';

import { useState, useEffect, type ReactNode } from 'react';

// ============================================================================
// Hydration Safe Provider
// ============================================================================
// Prevents React hydration mismatches by ensuring the first client render
// exactly matches the server render. This is critical for apps using
// Zustand persist (localStorage) where server state differs from client state.
//
// How it works:
// 1. Server render: Shows a minimal loading shell (same on server & client)
// 2. Client hydration: Initially renders the same loading shell (matches server)
// 3. After mount (useEffect): Replaces loading shell with actual app content
//
// This eliminates ALL hydration mismatches because the server HTML and
// the initial client render are identical.
// ============================================================================

interface HydrationSafeProviderProps {
  children: ReactNode;
}

export function HydrationSafeProvider({ children }: HydrationSafeProviderProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
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
