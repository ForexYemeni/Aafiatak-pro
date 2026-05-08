// GET /api/push/vapid-key - Get VAPID public key for client-side push subscription

export async function GET() {
  return Response.json({
    success: true,
    data: {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
    },
  });
}
