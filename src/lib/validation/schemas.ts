// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Input Validation Schemas
// ============================================================================
// Zod validation schemas with Arabic error messages for all API inputs.
// Ensures data integrity and provides user-friendly Arabic validation feedback.
// ============================================================================

import { z } from 'zod';

// ============================================================================
// Shared Arabic Error Messages
// ============================================================================

const arabicErrors = {
  required: 'هذا الحقل مطلوب',
  invalidPhone: 'رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويحتوي على 9 أرقام',
  invalidPassword: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم',
  invalidName: 'الاسم يجب أن يكون 2-50 حرفاً',
  invalidPrice: 'السعر يجب أن يكون رقماً موجباً',
  invalidDuration: 'المدة يجب أن تكون رقماً موجباً بالدقائق',
  invalidDiscount: 'نسبة الخصم يجب أن تكون بين 1 و 100',
  invalidMaxUses: 'الحد الأقصى للاستخدام يجب أن يكون رقماً موجباً',
  invalidScore: 'التقييم يجب أن يكون بين 1 و 5',
  invalidLat: 'خط العرض غير صالح',
  invalidLng: 'خط الطول غير صالح',
  invalidEmail: 'البريد الإلكتروني غير صالح',
  invalidUrl: 'الرابط غير صالح',
  invalidDate: 'التاريخ غير صالح',
  invalidFutureDate: 'يجب أن يكون التاريخ في المستقبل',
  tooShort: (min: number) => `يجب أن يكون ${min} أحرف على الأقل`,
  tooLong: (max: number) => `يجب ألا يتجاوز ${max} حرفاً`,
} as const;

// ============================================================================
// Phone Validation (Yemeni format)
// ============================================================================

/** Yemeni phone number regex: starts with 7, followed by 8 digits (total 9 digits) */
const yemeniPhoneRegex = /^7[0-9]{8}$/;

/** Phone schema with Yemeni format validation */
const phoneSchema = z
  .string()
  .min(1, arabicErrors.required)
  .regex(yemeniPhoneRegex, arabicErrors.invalidPhone);

// ============================================================================
// Password Validation
// ============================================================================

/** Password schema requiring minimum 8 chars, at least one letter and one number */
const passwordSchema = z
  .string()
  .min(8, arabicErrors.tooShort(8))
  .regex(/[a-zA-Z]/, arabicErrors.invalidPassword)
  .regex(/[0-9]/, arabicErrors.invalidPassword);

// ============================================================================
// Name Validation
// ============================================================================

/** Arabic/English name schema */
const nameSchema = z
  .string()
  .min(2, arabicErrors.invalidName)
  .max(50, arabicErrors.tooLong(50));

// ============================================================================
// Login Schema
// ============================================================================

/** Login request validation schema */
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, arabicErrors.required),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// Nurse Registration Schema
// ============================================================================

/** Nurse registration validation schema */
export const registerNurseSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, arabicErrors.required),
  specialization: z
    .array(z.string().min(1, arabicErrors.required))
    .min(1, 'يجب اختيار تخصص واحد على الأقل'),
  licenseNumber: z
    .string()
    .min(1, arabicErrors.required)
    .max(50, arabicErrors.tooLong(50)),
  experience: z
    .number({ invalid_type_error: 'سنوات الخبرة يجب أن تكون رقماً' })
    .int('سنوات الخبرة يجب أن تكون رقماً صحيحاً')
    .min(0, 'سنوات الخبرة يجب أن تكون 0 أو أكثر')
    .max(50, 'سنوات الخبرة يجب ألا تتجاوز 50'),
  governorate: z.string().min(1, arabicErrors.required),
  city: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().max(500, arabicErrors.tooLong(500)).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

export type RegisterNurseInput = z.infer<typeof registerNurseSchema>;

// ============================================================================
// Beneficiary Registration Schema
// ============================================================================

/** Beneficiary registration validation schema */
export const registerBeneficiarySchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, arabicErrors.required),
  address: z.string().min(1, arabicErrors.required).max(200, arabicErrors.tooLong(200)),
  governorate: z.string().min(1, arabicErrors.required),
  city: z.string().optional(),
  referralCode: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female'], {
    errorMap: () => ({ message: 'يجب اختيار الجنس' }),
  }).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

export type RegisterBeneficiaryInput = z.infer<typeof registerBeneficiarySchema>;

// ============================================================================
// Service Schema
// ============================================================================

/** Create service validation schema */
export const createServiceSchema = z.object({
  nameAr: z.string().min(1, arabicErrors.required).max(100, arabicErrors.tooLong(100)),
  nameEn: z.string().min(1, arabicErrors.required).max(100, arabicErrors.tooLong(100)),
  descriptionAr: z.string().max(500, arabicErrors.tooLong(500)).optional(),
  descriptionEn: z.string().max(500, arabicErrors.tooLong(500)).optional(),
  basePrice: z
    .number({ invalid_type_error: arabicErrors.invalidPrice })
    .positive(arabicErrors.invalidPrice),
  category: z.enum([
    'medical',
    'nursing',
    'physiotherapy',
    'elderly_care',
    'pediatric',
    'post_surgery',
    'lab',
    'emergency',
  ], {
    errorMap: () => ({ message: 'يجب اختيار فئة الخدمة' }),
  }),
  duration: z
    .number({ invalid_type_error: arabicErrors.invalidDuration })
    .int(arabicErrors.invalidDuration)
    .positive(arabicErrors.invalidDuration),
  icon: z.string().optional(),
  image: z.string().optional(),
  isEmergency: z.boolean().optional(),
  requirements: z.array(z.string()).optional(),
  includedItems: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

// ============================================================================
// Order Schema
// ============================================================================

/** Create order validation schema */
export const createOrderSchema = z.object({
  serviceId: z.string().min(1, arabicErrors.required),
  scheduledAt: z.string().optional(),
  address: z.string().min(1, arabicErrors.required).max(200, arabicErrors.tooLong(200)),
  lat: z
    .number({ invalid_type_error: arabicErrors.invalidLat })
    .min(-90, arabicErrors.invalidLat)
    .max(90, arabicErrors.invalidLat)
    .optional(),
  lng: z
    .number({ invalid_type_error: arabicErrors.invalidLng })
    .min(-180, arabicErrors.invalidLng)
    .max(180, arabicErrors.invalidLng)
    .optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'wallet_deposit', 'exchange_transfer', 'mobile_wallet'], {
    errorMap: () => ({ message: 'يجب اختيار طريقة الدفع' }),
  }),
  notes: z.string().max(500, arabicErrors.tooLong(500)).optional(),
  isEmergency: z.boolean().optional(),
  couponCode: z.string().optional(),
  useLoyaltyPoints: z.boolean().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ============================================================================
// Emergency Schema
// ============================================================================

/** Create emergency request validation schema */
export const createEmergencySchema = z.object({
  type: z.enum(['medical', 'injury', 'breathing', 'cardiac', 'fall', 'other'], {
    errorMap: () => ({ message: 'يجب اختيار نوع الطوارئ' }),
  }),
  description: z.string().min(1, arabicErrors.required).max(500, arabicErrors.tooLong(500)),
  lat: z
    .number({ invalid_type_error: arabicErrors.invalidLat })
    .min(-90, arabicErrors.invalidLat)
    .max(90, arabicErrors.invalidLat),
  lng: z
    .number({ invalid_type_error: arabicErrors.invalidLng })
    .min(-180, arabicErrors.invalidLng)
    .max(180, arabicErrors.invalidLng),
  address: z.string().optional(),
});

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;

// ============================================================================
// Coupon Schema
// ============================================================================

/** Create coupon validation schema */
export const createCouponSchema = z.object({
  code: z
    .string()
    .min(1, arabicErrors.required)
    .max(20, arabicErrors.tooLong(20))
    .regex(/^[A-Z0-9]+$/, 'كود الخصم يجب أن يحتوي على أحرف إنجليزية كبيرة وأرقام فقط'),
  discountPercent: z
    .number({ invalid_type_error: arabicErrors.invalidDiscount })
    .min(1, arabicErrors.invalidDiscount)
    .max(100, arabicErrors.invalidDiscount),
  maxUses: z
    .number({ invalid_type_error: arabicErrors.invalidMaxUses })
    .int(arabicErrors.invalidMaxUses)
    .positive(arabicErrors.invalidMaxUses),
  minOrderAmount: z.number().min(0, 'الحد الأدنى للطلب يجب أن يكون رقماً موجباً').optional(),
  maxDiscountAmount: z.number().positive('الحد الأقصى للخصم يجب أن يكون رقماً موجباً').optional(),
  expiresAt: z.string().min(1, arabicErrors.required),
  applicableCategories: z.array(z.string()).optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;

// ============================================================================
// Profile Update Schema
// ============================================================================

/** Update profile validation schema (works for both nurse and beneficiary) */
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  address: z.string().max(200, arabicErrors.tooLong(200)).optional(),
  city: z.string().max(50, arabicErrors.tooLong(50)).optional(),
  governorate: z.string().max(50, arabicErrors.tooLong(50)).optional(),
  district: z.string().max(50, arabicErrors.tooLong(50)).optional(),
  bio: z.string().max(500, arabicErrors.tooLong(500)).optional(),
  experience: z.number().int().min(0).max(50).optional(),
  specialization: z.array(z.string()).optional(),
  // Beneficiary-specific fields
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  medicalConditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  emergencyContactName: z.string().max(50, arabicErrors.tooLong(50)).optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().max(30, arabicErrors.tooLong(30)).optional(),
  // Wallet info for nurse payouts
  walletType: z.enum(['one_cash', 'jawali', 'yemen_wallet', 'saba_cash']).optional(),
  walletNumber: z.string().max(20, arabicErrors.tooLong(20)).optional(),
  bankAccount: z.string().max(50, arabicErrors.tooLong(50)).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================================
// Rating Schema
// ============================================================================

/** Rating validation schema */
export const ratingSchema = z.object({
  score: z
    .number({ invalid_type_error: arabicErrors.invalidScore })
    .int(arabicErrors.invalidScore)
    .min(1, arabicErrors.invalidScore)
    .max(5, arabicErrors.invalidScore),
  comment: z.string().max(500, arabicErrors.tooLong(500)).optional(),
  tags: z.array(z.string()).optional(),
  isAnonymous: z.boolean().optional(),
  requestId: z.string().min(1, arabicErrors.required),
});

export type RatingInput = z.infer<typeof ratingSchema>;

// ============================================================================
// Complaint Schema
// ============================================================================

/** Complaint validation schema */
export const complaintSchema = z.object({
  subject: z
    .string()
    .min(1, arabicErrors.required)
    .max(100, arabicErrors.tooLong(100)),
  description: z
    .string()
    .min(10, arabicErrors.tooShort(10))
    .max(1000, arabicErrors.tooLong(1000)),
  againstUserId: z.string().min(1, arabicErrors.required),
  requestId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], {
    errorMap: () => ({ message: 'يجب اختيار أولوية الشكوى' }),
  }).optional(),
  attachments: z.array(z.string()).optional(),
});

export type ComplaintInput = z.infer<typeof complaintSchema>;

// ============================================================================
// Password Change Schema
// ============================================================================

/** Password change validation schema */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, arabicErrors.required),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, arabicErrors.required),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmNewPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================================
// SubAdmin Creation Schema
// ============================================================================

/** SubAdmin creation validation schema */
export const createSubAdminSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  permissions: z.array(z.string()).min(1, 'يجب تحديد صلاحية واحدة على الأقل'),
  email: z.string().email(arabicErrors.invalidEmail).optional(),
});

export type CreateSubAdminInput = z.infer<typeof createSubAdminSchema>;

// ============================================================================
// Nurse Assignment Schema
// ============================================================================

/** Nurse assignment validation schema */
export const assignNurseSchema = z.object({
  nurseId: z.string().min(1, arabicErrors.required),
  estimatedArrivalMinutes: z.number().int().positive().optional(),
});

export type AssignNurseInput = z.infer<typeof assignNurseSchema>;

// ============================================================================
// Report Generation Schema
// ============================================================================

/** Report generation validation schema */
export const generateReportSchema = z.object({
  type: z.enum(['financial', 'operational', 'nurse_performance', 'beneficiary_activity'], {
    errorMap: () => ({ message: 'يجب اختيار نوع التقرير' }),
  }),
  dateRangeStart: z.string().min(1, arabicErrors.required),
  dateRangeEnd: z.string().min(1, arabicErrors.required),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// ============================================================================
// Loyalty Redemption Schema
// ============================================================================

/** Loyalty points redemption validation schema */
export const redeemLoyaltySchema = z.object({
  points: z
    .number({ invalid_type_error: 'عدد النقاط يجب أن يكون رقماً' })
    .int('عدد النقاط يجب أن يكون رقماً صحيحاً')
    .positive('عدد النقاط يجب أن يكون رقماً موجباً'),
});

export type RedeemLoyaltyInput = z.infer<typeof redeemLoyaltySchema>;

// ============================================================================
// FCM Token Registration Schema
// ============================================================================

/** FCM token registration validation schema */
export const registerTokenSchema = z.object({
  token: z.string().min(1, arabicErrors.required),
  platform: z.enum(['ios', 'android', 'web'], {
    errorMap: () => ({ message: 'يجب تحديد المنصة' }),
  }),
  deviceId: z.string().optional(),
});

export type RegisterTokenInput = z.infer<typeof registerTokenSchema>;

// ============================================================================
// Chat Message Schema
// ============================================================================

/** Chat message validation schema */
export const chatMessageSchema = z.object({
  chatId: z.string().min(1, arabicErrors.required),
  content: z.string().min(1, arabicErrors.required).max(2000, arabicErrors.tooLong(2000)),
  type: z.enum(['text', 'image', 'quick_reply']).optional(),
  replyTo: z.string().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ============================================================================
// Nurse Location Update Schema
// ============================================================================

/** Nurse location update validation schema */
export const nurseLocationSchema = z.object({
  lat: z
    .number({ invalid_type_error: arabicErrors.invalidLat })
    .min(-90, arabicErrors.invalidLat)
    .max(90, arabicErrors.invalidLat),
  lng: z
    .number({ invalid_type_error: arabicErrors.invalidLng })
    .min(-180, arabicErrors.invalidLng)
    .max(180, arabicErrors.invalidLng),
});

export type NurseLocationInput = z.infer<typeof nurseLocationSchema>;

// ============================================================================
// Admin Settings Update Schema
// ============================================================================

/** Admin settings update validation schema */
export const updateSettingsSchema = z.object({
  commissionRate: z.number().min(0).max(100).optional(),
  emergencyFee: z.number().min(0).optional(),
  nightFeePercent: z.number().min(0).max(100).optional(),
  fridayFeePercent: z.number().min(0).max(100).optional(),
  nightStartHour: z.number().int().min(0).max(23).optional(),
  nightEndHour: z.number().int().min(0).max(23).optional(),
  minOrderAmount: z.number().min(0).optional(),
  loyaltyPointsPerOrder: z.number().int().min(0).optional(),
  loyaltyRedemptionThreshold: z.number().int().min(0).optional(),
  referralReward: z.number().int().min(0).optional(),
  maxNurseAssignmentRadius: z.number().positive().optional(),
  autoAssignEnabled: z.boolean().optional(),
  emergencyAutoDispatch: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessageAr: z.string().optional(),
  maintenanceMessageEn: z.string().optional(),
  supportPhone: z.string().optional(),
  supportWhatsApp: z.string().optional(),
  termsAndConditionsAr: z.string().optional(),
  termsAndConditionsEn: z.string().optional(),
  privacyPolicyAr: z.string().optional(),
  privacyPolicyEn: z.string().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
