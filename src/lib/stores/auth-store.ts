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

// ---- Auth State Interface ----

interface AuthState {
  // State
  user: AppUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

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
}

// ---- API Helper ----

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'حدث خطأ في الطلب');
  }

  return data;
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
        // Fire and forget the logout API call
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
          // Ignore logout API errors
        });

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
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
    }
  )
);
