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
