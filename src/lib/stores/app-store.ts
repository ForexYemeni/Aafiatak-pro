// ============================================================================
// عافيتك App Store - Main Zustand Store for Global UI & Network State
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---- Types ----

type Theme = 'light' | 'dark' | 'system';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  theme: Theme;
  language: 'ar';

  // Network State
  isOnline: boolean;
  isSocketConnected: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  setSocketConnected: (connected: boolean) => void;
}

// ---- Safe Storage ----

function safeStorage() {
  if (typeof window !== 'undefined') {
    return localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// ---- App Store ----

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State — all values must match SSR output exactly
      // to prevent React hydration mismatch (Error #300).
      // navigator.onLine differs between server (undefined) and client (true/false),
      // so we default to true and update in useEffect.
      sidebarOpen: false,
      theme: 'system',
      language: 'ar',
      isOnline: true,
      isSocketConnected: false,

      // ---- Actions ----

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      setTheme: (theme: Theme) => {
        set({ theme });

        // Apply theme to document element for next-themes compatibility
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');

          if (theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(systemDark ? 'dark' : 'light');
          } else {
            root.classList.add(theme);
          }
        }
      },

      setOnlineStatus: (isOnline: boolean) => {
        set({ isOnline });
      },

      setSocketConnected: (connected: boolean) => {
        set({ isSocketConnected: connected });
      },
    }),
    {
      name: 'aafiatak-app-storage',
      // CRITICAL: skipHydration prevents Zustand from reading localStorage
      // synchronously during store creation. Without this, the store would
      // hydrate from localStorage BEFORE the first React render, causing
      // the client to render different values than the server → React Error #300.
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage()),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
      }),
    }
  )
);
