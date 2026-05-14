// ============================================================================
  // عافيتك (Aafiatak) — Server-side In-Memory Cache
  // ============================================================================
  // Lightweight TTL cache for semi-static data that is read on every request
  // but rarely changes (AdminSettings, Services list, etc.).
  //
  // Usage:
  //   const settings = await cachedAdminSettings();
  //   const services = await cachedServices();
  //
  // Cache is per-process (works well on Vercel because each region spins up
  // long-lived instances). TTL defaults to 5 minutes.
  // ============================================================================

  interface CacheEntry<T> {
    value: T;
    expiresAt: number;
  }

  const store = new Map<string, CacheEntry<unknown>>();

  export function setCached<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  export function getCached<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value;
  }

  export function invalidateCache(key: string): void {
    store.delete(key);
  }

  export function invalidateByPrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  // ── Typed helpers for common cached resources ──────────────────────────

  export async function withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 5 * 60 * 1000
  ): Promise<T> {
    const cached = getCached<T>(key);
    if (cached !== null) return cached;
    const value = await fetcher();
    setCached(key, value, ttlMs);
    return value;
  }

  // Cache keys
  export const CACHE_KEYS = {
    adminSettings: 'admin:settings',
    services: 'services:all',
    activeServices: 'services:active',
  } as const;
  