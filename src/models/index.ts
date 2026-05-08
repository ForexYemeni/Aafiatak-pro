// ── Aafiatak Healthcare Platform - Models Index ─────────────────────
// This file imports and re-exports all Mongoose models.
// Import models from this file to ensure they are registered with Mongoose.

// NOTE: Admin, SubAdmin, Coupon are now in src/models/mongoose/ only.
// The standalone versions were removed to avoid model name conflicts.

// ── User Models ─────────────────────────────────────────────────────
export { default as Nurse } from './Nurse';
export type { INurse, IVerificationDocument, IBankAccount, IGeoJSONPoint as NurseGeoPoint } from './Nurse';

export { default as Beneficiary } from './Beneficiary';
export type { IBeneficiary, IEmergencyContact, IGeoJSONPoint as BeneficiaryGeoPoint } from './Beneficiary';

// ── Service Models ──────────────────────────────────────────────────
export { default as Service } from './Service';
export type { IService } from './Service';

export { default as ServiceRequest } from './ServiceRequest';
export type { IServiceRequest, IPricing, ServiceRequestStatus, PaymentMethodType, PaymentStatusType } from './ServiceRequest';

export { default as ServiceAssignment } from './ServiceAssignment';
export type { IServiceAssignment, AssignmentStatus } from './ServiceAssignment';

// ── Emergency Models ────────────────────────────────────────────────
export { default as EmergencyRequest } from './EmergencyRequest';
export type { IEmergencyRequest, EmergencyType, EmergencyStatus } from './EmergencyRequest';

export { default as EmergencyAssignment } from './EmergencyAssignment';
export type { IEmergencyAssignment, EmergencyAssignmentStatus } from './EmergencyAssignment';

// ── Payment Models ──────────────────────────────────────────────────
export { default as PaymentMethod } from './PaymentMethod';
export type { IPaymentMethod, PaymentMethodTypeEnum, WalletTypeEnum } from './PaymentMethod';

// ── Logging & Communication Models ──────────────────────────────────
export { default as ActivityLog } from './ActivityLog';
export type { IActivityLog, UserRole } from './ActivityLog';

export { default as Chat } from './Chat';
export type { IChat, IParticipant, ILastMessage, ChatType } from './Chat';

// ── Marketing & Loyalty Models ──────────────────────────────────────
// Coupon is exported from mongoose models only (see src/models/mongoose/Coupon.ts)

export { default as LoyaltyPoints } from './LoyaltyPoints';
export type { ILoyaltyPoints, LoyaltyPointsType } from './LoyaltyPoints';

export { default as Referral } from './Referral';
export type { IReferral, IReferralReward, ReferralStatus } from './Referral';

// ── Notification Models ─────────────────────────────────────────────
export { default as PushNotification } from './PushNotification';
export type { IPushNotification, NotificationType, NotificationPriority } from './PushNotification';

export { default as FCMToken } from './FCMToken';
export type { IFCMToken, Platform } from './FCMToken';

// ── Rating Model ────────────────────────────────────────────────────
export { default as Rating } from './Rating';
export type { IRating, RatingFromRole, RatingToRole } from './Rating';

// ── Settings Model ──────────────────────────────────────────────────
export { default as AdminSettings } from './AdminSettings';
export type { IAdminSettings, IReferralRewardConfig } from './AdminSettings';

// ── WhatsApp Model ──────────────────────────────────────────────────
export { default as WhatsAppQueue } from './WhatsAppQueue';
export type { IWhatsAppQueue, WhatsAppQueueStatus } from './WhatsAppQueue';

// ── Appointment Model ───────────────────────────────────────────────
export { default as Appointment } from './Appointment';
export type { IAppointment, AppointmentStatus } from './Appointment';

// ── Report Model ────────────────────────────────────────────────────
export { default as Report } from './Report';
export type { IReport, ReportType, ReportFormat, IDateRange } from './Report';

// ── Transaction Model ───────────────────────────────────────────────
export { default as Transaction } from './Transaction';
export type { ITransaction, TransactionStatus, TransactionPaymentMethod } from './Transaction';
