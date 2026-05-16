import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BaseUser,
  AppUser,
  RegisterNurseRequest,
  RegisterBeneficiaryRequest,
  LoginResponse,
  RegisterNurseResponse,
  RegisterBeneficiaryResponse,
  RefreshTokenResponse,
  ApiResponse,
} from '@/types';
import { soundManager } from '@/lib/notifications/sound-manager';

// ---- Auth State Interface ----

interface AuthState {
  // State
  user: AppUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  login: (phone: string, password: string) => Promise<void>;
  registerNurse: (data: RegisterNurseRequest) => Promise<void>;
  registerBeneficiary: (data: RegisterBeneficiaryRequest) => Promise<void>;
  logout: () => void;
  refreshAuthToken: () => Promise<void>;
  updateUser: (data: Partial<BaseUser>) => void;
  clearError: () => void;
  setUser: (user: AppUser) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setHasHydrated: (state: boolean) => void;
}

// ---- API Helper ----

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (networkError) {
    throw new Error('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت');
  }

  // Try to parse JSON, handle non-JSON responses gracefully
  let data: any;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`خطأ في الخادم (${response.status})`);
    }
    throw new Error('حدث خطأ غير متوقع');
  }

  if (!data.success) {
    // Handle nested error structure: { success: false, error: { message, code } }
    // CRITICAL: data.error can be either a string OR an object { message, code }
    // We must NEVER pass an object to Error() — it would become "[object Object]"
    let errorMessage: string;
    if (typeof data.error === 'object' && data.error !== null) {
      errorMessage = data.error.message || data.message || 'حدث خطأ في الطلب';
    } else if (typeof data.error === 'string' && data.error) {
      errorMessage = data.error;
    } else {
      errorMessage = data.message || 'حدث خطأ في الطلب';
    }
    throw new Error(errorMessage);
  }

  return data as ApiResponse<T>;
}

// ---- Auth Store ----

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      // ---- Login ----
      login: async (phone: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<LoginResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password }),
          });

          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            // Unlock audio playback - user clicked login button
            soundManager.forceUserInteracted();
            // Note: welcome-back sound is handled by WelcomeBackPlayer in pwa-provider.tsx
            // to avoid duplicate sounds (race condition between this and WelcomeBackPlayer)
          } else {
            // API returned success but no data - unexpected format
            set({
              isLoading: false,
              error: 'استجابة غير متوقعة من الخادم',
              isAuthenticated: false,
              user: null,
              token: null,
              refreshToken: null,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل تسجيل الدخول';
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
          });
          throw error;
        }
      },

      // ---- Register Nurse ----
      registerNurse: async (data: RegisterNurseRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<RegisterNurseResponse>('/api/auth/register/nurse', {
            method: 'POST',
            body: JSON.stringify(data),
          });

          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            // Unlock audio playback - user clicked register button
            soundManager.forceUserInteracted();
          } else {
            set({
              isLoading: false,
              error: 'استجابة غير متوقعة من الخادم',
              isAuthenticated: false,
              user: null,
              token: null,
              refreshToken: null,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل تسجيل الممرض/ـة';
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
          });
          throw error;
        }
      },

      // ---- Register Beneficiary ----
      registerBeneficiary: async (data: RegisterBeneficiaryRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiRequest<RegisterBeneficiaryResponse>('/api/auth/register/beneficiary', {
            method: 'POST',
            body: JSON.stringify(data),
          });

          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            // Unlock audio playback - user clicked register button
            soundManager.forceUserInteracted();
          } else {
            set({
              isLoading: false,
              error: 'استجابة غير متوقعة من الخادم',
              isAuthenticated: false,
              user: null,
              token: null,
              refreshToken: null,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل تسجيل المستفيد';
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
          });
          throw error;
        }
      },

      // ---- Logout ----
      logout: () => {
        // Mark that user logged out (for "welcome back" sound on next login)
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('aafiatak-logged-out', 'true');
          } catch {
            // Ignore storage errors
          }
        }

        // Save token before clearing state (for API call)
        const currentToken = get().token;

        // Clear persisted storage immediately (before state change to prevent re-render)
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('aafiatak-auth-storage');
          } catch {
            // Ignore storage errors
          }
        }

        // IMPORTANT: Navigate FIRST before clearing state
        // This prevents components from re-rendering with user=null
        // which causes errors (e.g., user.name throws TypeError)
        if (typeof window !== 'undefined') {
          // Fire-and-forget the logout API call with the saved token
          // This clears the HttpOnly cookie on the server side
          fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
            headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {},
          }).catch(() => {
            // Ignore API errors — cookie will expire naturally
          });

          // Navigate IMMEDIATELY — don't wait for API response
          // Using window.location.href for a full page reload ensures
          // all state is cleanly reset and no stale renders occur
          window.location.href = '/?logout=true';
        }

        // DO NOT call set() here! Calling set() triggers React re-renders
        // that conflict with the pending hard navigation from window.location.href.
        // The AuthHydrationGuard sees isAuthenticated=false and fires router.replace(),
        // which races with the hard navigation, causing a brief error page.
        //
        // This is safe to skip because:
        // 1. localStorage.removeItem() already cleared persisted state (line above)
        // 2. window.location.href causes a full page reload — all JS state resets
        // 3. The reloaded page rehydrates Zustand from localStorage (now empty) → unauthenticated
      },

      // ---- Refresh Token ----
      refreshAuthToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const response = await apiRequest<RefreshTokenResponse>('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });

          if (response.success && response.data) {
            set({
              token: response.data.token,
              refreshToken: response.data.refreshToken,
            });
          }
        } catch {
          // If refresh fails, logout
          get().logout();
        }
      },

      // ---- Update User (partial update in local state) ----
      updateUser: (data: Partial<BaseUser>) => {
        const currentUser = get().user;
        if (!currentUser) return;

        set({
          user: { ...currentUser, ...data } as AppUser,
        });
      },

      // ---- Clear Error ----
      clearError: () => {
        set({ error: null });
      },

      // ---- Set User ----
      setUser: (user: AppUser) => {
        set({ user, isAuthenticated: true });
      },

      // ---- Set Tokens ----
      setTokens: (token: string, newRefreshToken: string) => {
        set({ token, refreshToken: newRefreshToken });
      },

      // ---- Set Hydration State ----
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'aafiatak-auth-storage',
      storage: createJSONStorage(() => {
        // Use localStorage on client, return a no-op for SSR
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          // Skip on server (SSR) - hydration only matters on client
          if (typeof window === 'undefined') return;

          // Use setTimeout(0) to defer setState until after the store
          // is fully initialized.
          setTimeout(() => {
            if (error) {
              console.error('[AuthStore] Rehydration error:', error);
              try {
                localStorage.removeItem('aafiatak-auth-storage');
              } catch {}
              useAuthStore.setState({ _hasHydrated: true, isAuthenticated: false, user: null, token: null, refreshToken: null });
              return;
            }

            // Mark hydration as complete so the app can render.
            // DO NOT validate the token here — that is done by the
            // login page (page.tsx) and the AuthHydrationGuard.
            // Validating here caused a race condition where this callback
            // and the login-page useEffect both called /api/auth/me
            // and could clear each other's state, producing redirect loops.
            useAuthStore.setState({ _hasHydrated: true });
          }, 0);
        };
      },
    }
  )
);
