// GET /api/push/vapid-key — Returns the VAPID public key for client-side push subscription.
// The public key is safe to expose; only the private key must stay secret.

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    console.warn('[PUSH] VAPID_PUBLIC_KEY is not set — push subscriptions will not work.');
    return Response.json(
      { success: false, error: { message: 'Push notifications are not configured on this server.', code: 'VAPID_NOT_CONFIGURED' } },
      { status: 503 }
    );
  }

  return Response.json({ success: true, data: { publicKey } });
}
