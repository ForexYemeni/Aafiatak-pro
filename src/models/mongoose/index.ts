// MongoDB Mongoose Models - Aafiatak (عافيتك) Healthcare Platform
// This index file re-exports all models and ensures connectDB is available

export { connectDB, default } from '@/lib/mongodb';

// User models (with discriminator pattern)
export { User } from './User';
export type { IUser } from './User';

export { Nurse } from './Nurse';
export type { INurse } from './Nurse';

export { Beneficiary } from './Beneficiary';
export type { IBeneficiary } from './Beneficiary';

// Service models
export { Service } from './Service';
export type { IService } from './Service';

export { ServiceRequest } from './ServiceRequest';
export type { IServiceRequest } from './ServiceRequest';

export { EmergencyRequest } from './EmergencyRequest';
export type { IEmergencyRequest } from './EmergencyRequest';

// Chat models
export { Chat } from './Chat';
export type { IChat } from './Chat';

export { ChatMessage } from './ChatMessage';
export type { IChatMessage } from './ChatMessage';

// Notification model (MongoDB-based, NO Firebase)
export { Notification } from './Notification';
export type { INotification } from './Notification';

// FCM/Push Token model (Web Push subscriptions)
export { default as FCMToken } from '@/models/FCMToken';
export type { IFCMToken, Platform as FCMPlatform } from '@/models/FCMToken';

// Rating model
export { Rating } from './Rating';
export type { IRating } from './Rating';

// Transaction model
export { Transaction } from './Transaction';
export type { ITransaction } from './Transaction';

// Coupon model
export { Coupon } from './Coupon';
export type { ICoupon } from './Coupon';

// Loyalty model
export { LoyaltyTransaction } from './LoyaltyTransaction';
export type { ILoyaltyTransaction } from './LoyaltyTransaction';

// Referral model
export { Referral } from './Referral';
export type { IReferral } from './Referral';

// Activity log model
export { ActivityLog } from './ActivityLog';
export type { IActivityLog } from './ActivityLog';

// Admin settings model
export { AdminSettings } from './AdminSettings';
export type { IAdminSettings } from './AdminSettings';

// Withdrawal request model
export { WithdrawalRequest } from './WithdrawalRequest';
export type { IWithdrawalRequest } from './WithdrawalRequest';

// Deployment/Assignment model (تكليف)
export { Deployment } from './Deployment';
export type { IDeployment, IDeploymentApplication } from './Deployment';

// Specialization model (تخصصات)
export { Specialization } from './Specialization';
export type { ISpecialization } from './Specialization';

// Firebase Config model (إعدادات Firebase)
export { default as FirebaseConfig } from './FirebaseConfig';
export type { IFirebaseConfig } from './FirebaseConfig';

// Complaint model (الشكاوى والبلاغات)
export { Complaint } from './Complaint';
export type { IComplaint, ComplaintStatus, ComplaintPriority } from './Complaint';

// Special Service Request model (طلب الخدمة الخاصة)
export { SpecialServiceRequest } from './SpecialServiceRequest';
export type { ISpecialServiceRequest, ISpecialServiceMessage, IOfferRecord, SpecialServiceStatus, SpecialServiceMessageType } from './SpecialServiceRequest';
