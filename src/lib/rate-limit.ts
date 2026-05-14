// ============================================================================
// عافيتك (Aafiatak) — Rate Limiting
// ============================================================================
// Uses Upstash Redis when env vars are configured (production-grade, works
// across all serverless instances). Falls back to an in-memory store for
// local development, but logs a clear warning so developers know it won't
// hold across serverless instances in production.
//
// Setup (Upstash free tier — works on Vercel):
//   1. Create a free Redis DB at https://console.upstash.com
//   2. Add to .env:
//        UPSTASH_REDIS_REST_URL=https://...upstash.io
//        UPSTASH_REDIS_REST_TOKEN=AX...
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Upstash-based limiter (production) ────────────────────────────

async function upstashCheck(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

  const windowSec = Math.ceil(windowMs / 1000);
  const now = Date.now();
  const resetAt = now + windowMs;

  // INCR + EXPIRE in a single pipeline
  const pipeline = [
    ['INCR', key],
    ['EXPIRE', key, String(windowSec), 'NX'],
  ];

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
    // Short timeout — if Redis is unreachable, allow the request through
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    // Redis unreachable — fail open (allow request) to avoid blocking users
    console.warn('[RATE_LIMIT] Upstash request failed, failing open:', response.status);
    return { allowed: true, remaining: limit, resetAt };
  }

  const data = (await response.json()) as [{ result: number }, { result: number }];
  const count = data[0]?.result ?? 1;
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  return { allowed, remaining, resetAt };
}

// ── In-memory limiter (development fallback) ───────────────────────

const memStore = new Map<string, { count: number; resetAt: number }>();

function memCheck(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const record = memStore.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    memStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  record.count += 1;
  const allowed = record.count <= limit;
  return { allowed, remaining: Math.max(0, limit - record.count), resetAt: record.resetAt };
}

// ── Public API ─────────────────────────────────────────────────────

const UPSTASH_CONFIGURED = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

if (!UPSTASH_CONFIGURED && process.env.NODE_ENV === 'production') {
  console.warn(
    '[RATE_LIMIT] WARNING: Running in production without Upstash Redis. ' +
    'Rate limiting is in-memory only and will NOT persist across serverless instances. ' +
    'Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your environment variables.'
  );
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (UPSTASH_CONFIGURED) {
    try {
      return await upstashCheck(key, limit, windowMs);
    } catch (err) {
      console.warn('[RATE_LIMIT] Upstash error, falling back to in-memory:', err);
    }
  }
  return memCheck(key, limit, windowMs);
}

// ── Preset configurations ──────────────────────────────────────────

export const RATE_LIMITS = {
  api: { limit: 200, windowMs: 15 * 60 * 1000 },
  auth: { limit: 20, windowMs: 15 * 60 * 1000 },
  upload: { limit: 30, windowMs: 15 * 60 * 1000 },
} as const;
