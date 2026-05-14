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

// ---- useAuthFetch GET Cache ----
// In-memory cache for GET requests — speeds up navigation by reusing data
// across page transitions within the same session.

interface CachedResponse {
  bodyText: string;
  status: number;
  ok: boolean;
  ts: number;
}

const _GET_CACHE = new Map<string, CachedResponse>();
const _GET_CACHE_TTL = 30_000; // 30 seconds

function _getCacheKey(url: string, userId: string): string {
  return `${url}::${userId}`;
}

function _makeResponseFromCache(cached: CachedResponse): Response {
  return new Response(cached.bodyText, {
    status: cached.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Clear the GET cache for a given URL prefix (call after mutations) */
export function invalidateAuthFetchCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    _GET_CACHE.clear();
    return;
  }
  for (const key of Array.from(_GET_CACHE.keys())) {
    if (key.startsWith(urlPrefix)) {
      _GET_CACHE.delete(key);
    }
  }
}

// ---- useAuthFetch (OPTIMIZED) ----

/**
 * Hook that provides an authenticated fetch wrapper.
 * Automatically adds the Authorization header and handles token refresh.
 * GET requests are cached for 30 seconds to speed up navigation.
 */
export function useAuthFetch() {
  const refreshAuthToken = useAuthStore((s) => s.refreshAuthToken);
  const logout = useAuthStore((s) => s.logout);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Get current state synchronously (no subscription needed)
      const { _hasHydrated } = useAuthStore.getState();

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

      const isGetRequest = !options.method || options.method.toUpperCase() === 'GET';

      // Check GET cache before hitting the network
      if (isGetRequest) {
        const userId = useAuthStore.getState().user?.id ?? 'anon';
        const cacheKey = _getCacheKey(url, userId);
        const cached = _GET_CACHE.get(cacheKey);
        if (cached && Date.now() - cached.ts < _GET_CACHE_TTL) {
          return _makeResponseFromCache(cached);
        }
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

      // Cache successful GET responses
      if (isGetRequest && response.ok) {
        try {
          const bodyText = await response.text();
          const userId = useAuthStore.getState().user?.id ?? 'anon';
          const cacheKey = _getCacheKey(url, userId);
          _GET_CACHE.set(cacheKey, {
            bodyText,
            status: response.status,
            ok: response.ok,
            ts: Date.now(),
          });
          // Trim cache size (keep last 100 entries)
          if (_GET_CACHE.size > 100) {
            const firstKey = _GET_CACHE.keys().next().value;
            if (firstKey) _GET_CACHE.delete(firstKey);
          }
          return new Response(bodyText, {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch {
          // If caching fails, return original response as-is
        }
      }

      return response;
    },
    [refreshAuthToken, logout]
  );

  return authFetch;
}
