// POST /api/admin/repair-referrals - Fix referral data type inconsistencies
// Converts string referrerId/referredBy fields to proper ObjectId types
// Admin-only endpoint

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const referralsCollection = db.collection('referrals');

    const results = {
      referralsFixed: 0,
      usersReferredByFixed: 0,
      errors: [] as string[],
    };

    // 1. Fix Referral collection: convert string referrerId to ObjectId
    try {
      // Find all referral records where referrerId is a string (not ObjectId)
      const stringReferrerRecords = await referralsCollection.find({
        $expr: { $eq: [{ $type: '$referrerId' }, 'string'] },
      }).toArray();

      for (const record of stringReferrerRecords) {
        try {
          const objectId = new mongoose.Types.ObjectId(record.referrerId);
          await referralsCollection.updateOne(
            { _id: record._id },
            { $set: { referrerId: objectId } }
          );
          results.referralsFixed++;
        } catch (e: any) {
          results.errors.push(`Referral ${record._id}: ${e.message}`);
        }
      }

      // Also fix referredId if stored as string
      const stringReferredRecords = await referralsCollection.find({
        $expr: { $eq: [{ $type: '$referredId' }, 'string'] },
      }).toArray();

      for (const record of stringReferredRecords) {
        try {
          const objectId = new mongoose.Types.ObjectId(record.referredId);
          await referralsCollection.updateOne(
            { _id: record._id },
            { $set: { referredId: objectId } }
          );
          results.referralsFixed++;
        } catch (e: any) {
          results.errors.push(`Referral referredId ${record._id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      results.errors.push(`Referral scan error: ${e.message}`);
    }

    // 2. Fix Users collection: convert string referredBy to ObjectId
    try {
      const stringReferredByUsers = await usersCollection.find({
        referredBy: { $exists: true, $ne: null },
        $expr: { $eq: [{ $type: '$referredBy' }, 'string'] },
        role: 'beneficiary',
      }).toArray();

      for (const user of stringReferredByUsers) {
        try {
          const objectId = new mongoose.Types.ObjectId(user.referredBy);
          await usersCollection.updateOne(
            { _id: user._id },
            { $set: { referredBy: objectId } }
          );
          results.usersReferredByFixed++;
        } catch (e: any) {
          results.errors.push(`User ${user._id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      results.errors.push(`User scan error: ${e.message}`);
    }

    return Response.json({
      success: true,
      data: results,
      message: `تم إصلاح ${results.referralsFixed} سجل إحالة و ${results.usersReferredByFixed} حقل referredBy`,
    });
  } catch (error) {
    console.error('[REPAIR REFERRALS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إصلاح بيانات الإحالات', 500, 'INTERNAL_ERROR');
  }
}
