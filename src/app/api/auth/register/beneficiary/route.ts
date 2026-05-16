// POST /api/auth/register/beneficiary - Register new beneficiary
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports referral code validation and referral record creation

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import {
  hashPassword,
  validateYemeniPhone,
  normalizeYemeniPhone,
  generateReferralCode,
  generateToken,
  generateRefreshToken,
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth';

const REFERRAL_REWARD_POINTS = 50;
const REFERRAL_REferred_POINTS = 25;

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, phone, password, governorate, district, address, referralCode: usedReferralCode } = await request.json();

    if (!name || !phone || !password) {
      return createErrorResponse('الاسم ورقم الهاتف وكلمة المرور مطلوبون', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 8) {
      return createErrorResponse('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // Check if phone already exists
    const existing = await Beneficiary.findOne({ phone: normalizedPhone });
    if (existing) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    // ── Generate unique referral code ──────────────────────────────
    let referralCode = generateReferralCode();
    // Ensure uniqueness (extremely rare collision, but safe)
    for (let attempts = 0; attempts < 5; attempts++) {
      const codeExists = await Beneficiary.findOne({ referralCode });
      if (!codeExists) break;
      referralCode = generateReferralCode();
    }

    // ── Validate referral code if provided ─────────────────────────
    let referrerId: string | null = null;
    let referrerCode: string | null = null; // Store the actual referrer's code for the Referral record
    if (usedReferralCode && typeof usedReferralCode === 'string') {
      const normalizedCode = usedReferralCode.trim().toUpperCase();
      // Support both AF-XXXXXX and AFK-XXXXXX (legacy) formats
      const referrer = await Beneficiary.findOne({ referralCode: normalizedCode }).select('_id referralCode').lean();
      if (referrer) {
        referrerId = referrer._id.toString();
        referrerCode = referrer.referralCode; // The referrer's actual code (not the new user's code)
      }
      // If code not found, we still proceed but without linking (no error thrown)
      // This prevents registration failure due to typos in referral codes
    }

    const hashedPassword = await hashPassword(password);

    const beneficiary = await Beneficiary.create({
      name,
      phone: normalizedPhone,
      password: hashedPassword,
      role: 'beneficiary',
      referralCode,
      referredBy: referrerId || undefined,
      governorate,
      district,
      address,
      isActive: true,
    });

    // ── Create Referral record and award points ────────────────────
    if (referrerId) {
      try {
        // Create the referral tracking record
        // CRITICAL: `code` must be the REFERRER's code (the code that was used), NOT the new user's code
        await Referral.create({
          referrerId,
          referredId: beneficiary._id,
          code: referrerCode || (usedReferralCode ? usedReferralCode.trim().toUpperCase() : ''),
          reward: REFERRAL_REWARD_POINTS,
          status: 'completed',
          completedAt: new Date(),
        });

        // Award loyalty points to referrer
        await Beneficiary.findByIdAndUpdate(referrerId, {
          $inc: { loyaltyPoints: REFERRAL_REWARD_POINTS },
        });

        // Award loyalty points to the new user (referred bonus)
        await Beneficiary.findByIdAndUpdate(beneficiary._id, {
          $inc: { loyaltyPoints: REFERRAL_REferred_POINTS },
        });
      } catch (referralError) {
        // Log but don't fail registration if referral processing fails
        console.error('[REGISTER REFERRAL PROCESSING ERROR]', referralError);
      }
    }

    // Generate tokens for auto-login
    const tokenPayload = {
      userId: beneficiary._id.toString(),
      phone: beneficiary.phone,
      role: beneficiary.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const responseData = {
      user: {
        id: beneficiary._id.toString(),
        name: beneficiary.name,
        phone: beneficiary.phone,
        role: beneficiary.role,
        referralCode: beneficiary.referralCode,
        governorate: beneficiary.governorate,
        district: beneficiary.district,
        isActive: beneficiary.isActive,
      },
      token,
      refreshToken,
    };

    const response = Response.json(
      { success: true, data: responseData, message: 'تم إنشاء الحساب بنجاح' },
      { status: 201 }
    );

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('[REGISTER BENEFICIARY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الحساب', 500, 'INTERNAL_ERROR');
  }
}
