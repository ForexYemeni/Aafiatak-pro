'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

// ---- useAuth (OPTIMIZED) ----

/**
 * Main auth hook - returns auth state and all methods.
 * OPTIMIZED: Uses specific selectors to avoid unnecessary re-renders.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const login = useAuthStore((s) => s.login);
  const registerNurse = useAuthStore((s) => s.registerNurse);
  const registerBeneficiary = useAuthStore((s) => s.registerBeneficiary);
  const logout = useAuthStore((s) => s.logout);
  const refreshAuthToken = useAuthStore((s) => s.refreshAuthToken);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearError = useAuthStore((s) => s.clearError);
  const setUser = useAuthStore((s) => s.setUser);
  const setTokens = useAuthStore((s) => s.setTokens);

  return {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    _hasHydrated,
    login,
    registerNurse,
    registerBeneficiary,
    logout,
    refreshAuthToken,
    updateUser,
    clearError,
    setUser,
    setTokens,
  };
}

// ---- useRequireAuth (OPTIMIZED) ----

/**
 * Redirects to login if not authenticated.
 * OPTIMIZED: Uses specific selectors.
 */
export function useRequireAuth(redirectPath?: string) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = redirectPath ?? window.location.pathname;
      router.replace(`/?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthenticated, isLoading, router, redirectPath]);

  return useAuth();
}

// ---- useRole ----

/**
 * Returns the current user's role, or null if not authenticated.
 */
export function useRole(): UserRole | null {
  const user = useAuthStore((state) => state.user);
  return user?.role ?? null;
}

// ---- useIsAdmin ----

/**
 * Returns true if the current user is an admin or subadmin.
 */
export function useIsAdmin(): boolean {
  const role = useRole();
  return role === 'admin' || role === 'subadmin';
}

// ---- useIsNurse ----

/**
 * Returns true if the current user is a nurse.
 */
export function useIsNurse(): boolean {
  const role = useRole();
  return role === 'nurse';
}

// ---- useIsBeneficiary ----

/**
 * Returns true if the current user is a beneficiary.
 */
export function useIsBeneficiary(): boolean {
  const role = useRole();
  return role === 'beneficiary';
}

// ---- useAuthFetch (OPTIMIZED) ----

/**
 * Hook that provides an authenticated fetch wrapper.
 * Automatically adds the Authorization header and handles token refresh.
 * OPTIMIZED: No busy-wait polling. Checks hydration synchronously.
 */
export function useAuthFetch() {
  const refreshAuthToken = useAuthStore((s) => s.refreshAuthToken);
  const logout = useAuthStore((s) => s.logout);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Get current state synchronously (no subscription needed)
      const { _hasHydrated, token: currentToken } = useAuthStore.getState();

      // Wait for hydration with a single check + short sleep (max 500ms instead of 3s)
      if (!_hasHydrated) {
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 50));
          if (useAuthStore.getState()._hasHydrated) break;
        }
      }

      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error('غير مصادق عليه');
      }

      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      const isFormData = options.body instanceof FormData;
      if (!isFormData) {
        headers.set('Content-Type', 'application/json');
      }

      let response = await fetch(url, {
        ...options,
        headers,
      });

      // If 401, try refreshing the token once
      if (response.status === 401) {
        try {
          await refreshAuthToken();
          const newToken = useAuthStore.getState().token;
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            response = await fetch(url, {
              ...options,
              headers,
            });
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }

      return response;
    },
    [refreshAuthToken, logout]
  );

  return authFetch;
}
