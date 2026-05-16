// ============================================================================
// Navigation Cache — Instant page transitions
// ============================================================================
// Caches the rendered HTML of visited pages so that when the user navigates
// back, the page appears instantly while fresh data loads in the background.
//
// This is a CLIENT-ONLY module — imported dynamically with ssr: false.
// ============================================================================

interface CachedPage {
  html: string;
  scrollY: number;
  timestamp: number;
  pathname: string;
}

const CACHE_KEY = 'aafiatak-nav-cache';
const MAX_CACHED_PAGES = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cache: Map<string, CachedPage> = new Map();

// Load cache from sessionStorage on init
function loadCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as [string, CachedPage][];
      const now = Date.now();
      // Filter out expired entries
      const valid = parsed.filter(([, v]) => now - v.timestamp < CACHE_TTL);
      cache = new Map(valid);
    }
  } catch {
    cache = new Map();
  }
}

// Save cache to sessionStorage
function saveCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(cache.entries()).slice(-MAX_CACHED_PAGES);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage might be full — ignore
  }
}

// Initialize cache on first import
if (typeof window !== 'undefined') {
  loadCache();
}

/**
 * Cache the current page's main content area
 */
export function cacheCurrentPage(pathname: string): void {
  if (typeof window === 'undefined') return;

  try {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    const html = mainContent.innerHTML;
    const scrollY = window.scrollY;

    cache.set(pathname, {
      html,
      scrollY,
      timestamp: Date.now(),
      pathname,
    });

    // Trim cache if too large
    if (cache.size > MAX_CACHED_PAGES) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }

    saveCache();
  } catch {
    // Ignore errors
  }
}

/**
 * Get cached page HTML for a pathname
 */
export function getCachedPage(pathname: string): CachedPage | null {
  const cached = cache.get(pathname);
  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.timestamp >= CACHE_TTL) {
    cache.delete(pathname);
    return null;
  }

  return cached;
}

/**
 * Check if a page is cached
 */
export function isPageCached(pathname: string): boolean {
  return getCachedPage(pathname) !== null;
}

/**
 * Invalidate cache for a specific path prefix
 */
export function invalidateCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    cache.clear();
  } else {
    for (const key of Array.from(cache.keys())) {
      if (key.startsWith(pathPrefix)) {
        cache.delete(key);
      }
    }
  }
  saveCache();
}

/**
 * Pre-render a page by navigating to it in the background
 * (Used for likely next-page prefetching)
 */
export function prefetchPageRoute(pathname: string): void {
  // This is handled by Next.js router.prefetch() in RolePrefetcher
  // We just cache the fact that this route was prefetched
}
