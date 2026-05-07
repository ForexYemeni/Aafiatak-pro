'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/types';

// ---- useAuth ----

/**
 * Main auth hook - returns auth state and all methods.
 */
export function useAuth() {
  const store = useAuthStore();
  return store;
}

// ---- useRequireAuth ----

/**
 * Redirects to login if not authenticated.
 * Returns the auth state and methods.
 * @param redirectPath - The path to redirect to after login (default: current path)
 */
export function useRequireAuth(redirectPath?: string) {
  const router = useRouter();
  const store = useAuthStore();
  const { isAuthenticated, isLoading } = store;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = redirectPath ?? window.location.pathname;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthenticated, isLoading, router, redirectPath]);

  return store;
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

// ---- useAuthFetch ----

/**
 * Hook that provides an authenticated fetch wrapper.
 * Automatically adds the Authorization header and handles token refresh.
 */
export function useAuthFetch() {
  const token = useAuthStore((state) => state.token);
  const refreshAuthToken = useAuthStore((state) => state.refreshAuthToken);
  const logout = useAuthStore((state) => state.logout);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (!token) {
        throw new Error('غير مصادق عليه');
      }

      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Content-Type', 'application/json');

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
    [token, refreshAuthToken, logout]
  );

  return authFetch;
}
