// GET /api/push/vapid-key - Get VAPID public key for client-side push subscription

// Hardcoded fallback ensures push subscriptions work even without env vars
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BN36yGFOlkT2JcWmoW_vDsUBxD9icwAisjLwRZ9imYkWfExWulyeGjd0ANwWP7uZOr26p6trG3RjhJ1CxNGVtrU';

export async function GET() {
  return Response.json({
    success: true,
    data: {
      publicKey: VAPID_PUBLIC_KEY,
    },
  });
}
