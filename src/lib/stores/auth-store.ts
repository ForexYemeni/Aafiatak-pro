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
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
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
    const errorMessage = data.error?.message || data.message || data.error || 'حدث خطأ في الطلب';
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
        // Clear local state immediately
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        // Clear persisted storage immediately
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('aafiatak-auth-storage');
          } catch {
            // Ignore storage errors
          }
        }

        // Await the logout API call to ensure the HttpOnly cookie is cleared,
        // THEN navigate. Use a timeout fallback to prevent hanging.
        const navigateHome = () => {
          if (typeof window !== 'undefined') {
            window.location.href = '/?logout=true';
          }
        };

        // Try to call the logout API with a 3-second timeout
        const logoutPromise = fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        }).catch(() => {
          // Ignore API errors
        });

        // Race: if API doesn't respond in 3 seconds, navigate anyway
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(resolve, 3000);
        });

        Promise.race([logoutPromise, timeoutPromise]).then(navigateHome);
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
          // ALWAYS set _hasHydrated to true, even if there was an error.
          // This prevents the app from being stuck on the loading screen forever.
          if (error) {
            console.error('[AuthStore] Rehydration error:', error);
            // Clear corrupted state so the user can start fresh
            try {
              localStorage.removeItem('aafiatak-auth-storage');
            } catch {}
          }

          // Validate the stored token if the user appears authenticated
          if (!error && state?.isAuthenticated && state?.token) {
            // Validate token with the server in the background
            fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${state.token}` },
            })
              .then(res => {
                if (!res.ok) {
                  // Token is invalid — clear auth state
                  console.warn('[AuthStore] Stored token is invalid, clearing auth state');
                  useAuthStore.setState({
                    user: null,
                    token: null,
                    refreshToken: null,
                    isAuthenticated: false,
                  });
                  try {
                    localStorage.removeItem('aafiatak-auth-storage');
                  } catch {}
                }
              })
              .catch(() => {
                // Network error — keep the stored auth state,
                // the user might be offline
              });
          }

          // Use setTimeout to ensure the store is fully initialized before setting
          setTimeout(() => {
            useAuthStore.setState({ _hasHydrated: true });
          }, 0);
        };
      },
    }
  )
);
