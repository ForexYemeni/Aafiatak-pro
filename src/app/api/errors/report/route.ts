import { NextRequest, NextResponse } from 'next/server';
  import { logger } from '@/lib/logger';

  // ============================================================================
  // POST /api/errors/report
  // Client-side error reporting endpoint.
  // Receives errors from error boundary components and logs them server-side.
  // No auth required — errors can happen before auth is established.
  // ============================================================================

  export async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const { message, digest, stack, component, url } = body;

      logger.error(
        {
          type: 'client_error_boundary',
          component: component || 'unknown',
          digest: digest || null,
          url: url || null,
          stack: stack || null,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        },
        `[ClientError] ${message || 'Unknown error'}`
      );

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch {
      // Never let the error reporter itself throw
      return NextResponse.json({ ok: false }, { status: 200 });
    }
  }
  