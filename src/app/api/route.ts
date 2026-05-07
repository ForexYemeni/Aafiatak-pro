// GET /api - API health check and info
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'عافيتك (Aafiatak) Healthcare Platform API',
    version: '2.0.0',
    database: 'MongoDB/Mongoose',
    endpoints: {
      auth: ['/api/auth/login', '/api/auth/register/beneficiary', '/api/auth/register/nurse', '/api/auth/me', '/api/auth/logout', '/api/auth/refresh'],
      admin: ['/api/admin/dashboard', '/api/admin/nurses', '/api/admin/beneficiaries', '/api/admin/orders', '/api/admin/emergencies', '/api/admin/services', '/api/admin/coupons', '/api/admin/settings', '/api/admin/transactions', '/api/admin/reports', '/api/admin/complaints', '/api/admin/subadmins', '/api/admin/activity-log'],
      nurse: ['/api/nurse/profile', '/api/nurse/availability', '/api/nurse/location', '/api/nurse/assignments', '/api/nurse/schedule', '/api/nurse/earnings', '/api/nurse/ratings', '/api/nurse/documents'],
      beneficiary: ['/api/beneficiary/profile', '/api/beneficiary/services', '/api/beneficiary/orders', '/api/beneficiary/emergency', '/api/beneficiary/loyalty', '/api/beneficiary/referral', '/api/beneficiary/ratings', '/api/beneficiary/payments', '/api/beneficiary/coupons/validate', '/api/beneficiary/favorites', '/api/beneficiary/complaints', '/api/beneficiary/tracking/[nurseId]'],
      chat: ['/api/chat', '/api/chat/[id]/messages'],
      notifications: ['/api/notifications', '/api/notifications/[id]/read', '/api/notifications/register-token'],
      general: ['/api/payments/methods', '/api/upload'],
    },
  });
}
