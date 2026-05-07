// GET /api/admin/reports - Generate reports
// POST /api/admin/reports - Create report

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const type = url.searchParams.get('type') ?? '';

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.report.count({ where }),
    ]);

    const parsed = reports.map((r) => ({
      ...r,
      data: safeJsonParse<Record<string, unknown>>(r.data, {}),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const type = body.type ?? 'operational';
    const dateRangeStart = body.dateRangeStart ? new Date(body.dateRangeStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateRangeEnd = body.dateRangeEnd ? new Date(body.dateRangeEnd) : new Date();

    let reportData: Record<string, unknown> = {};

    if (type === 'financial') {
      const transactions = await db.transaction.findMany({
        where: {
          status: 'completed',
          processedAt: { gte: dateRangeStart, lte: dateRangeEnd },
        },
      });
      const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalCommission = transactions.reduce((sum, t) => sum + t.commission, 0);
      reportData = { totalRevenue, totalCommission, transactionCount: transactions.length };
    } else if (type === 'operational') {
      const [totalOrders, completedOrders, cancelledOrders, avgRating] = await Promise.all([
        db.serviceRequest.count({ where: { createdAt: { gte: dateRangeStart, lte: dateRangeEnd } } }),
        db.serviceRequest.count({ where: { status: 'completed', createdAt: { gte: dateRangeStart, lte: dateRangeEnd } } }),
        db.serviceRequest.count({ where: { status: 'cancelled', createdAt: { gte: dateRangeStart, lte: dateRangeEnd } } }),
        db.nurse.aggregate({ _avg: { rating: true }, where: { reviewCount: { gt: 0 } } }),
      ]);
      reportData = { totalOrders, completedOrders, cancelledOrders, averageRating: avgRating._avg.rating ?? 0 };
    } else if (type === 'nurse_performance') {
      const nurses = await db.nurse.findMany({
        where: { isActive: true },
        select: { id: true, name: true, completedJobs: true, cancelledJobs: true, rating: true, totalEarnings: true },
        orderBy: { completedJobs: 'desc' },
        take: 20,
      });
      reportData = { topNurses: nurses };
    } else if (type === 'beneficiary_activity') {
      const [newBeneficiaries, activeBeneficiaries] = await Promise.all([
        db.beneficiary.count({ where: { createdAt: { gte: dateRangeStart, lte: dateRangeEnd } } }),
        db.beneficiary.count({ where: { orderCount: { gt: 0 } } }),
      ]);
      reportData = { newBeneficiaries, activeBeneficiaries };
    }

    const report = await db.report.create({
      data: {
        type,
        title: body.title ?? `تقرير ${type} - ${dateRangeStart.toISOString().split('T')[0]} إلى ${dateRangeEnd.toISOString().split('T')[0]}`,
        generatedById: user.userId,
        data: JSON.stringify(reportData),
        format: body.format ?? 'json',
        dateRangeStart,
        dateRangeEnd,
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'generate_report',
      entity: 'Report',
      entityId: report.id,
      details: `تم إنشاء تقرير: ${report.title}`,
      request,
    });

    return successResponse({ ...report, data: safeJsonParse<Record<string, unknown>>(report.data, {}) }, 'تم إنشاء التقرير بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
