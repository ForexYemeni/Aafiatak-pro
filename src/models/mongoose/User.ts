import mongoose, { Schema, Document } from 'mongoose';

export type SubAdminPermission =
  | 'manage_nurses'
  | 'manage_beneficiaries'
  | 'manage_orders'
  | 'manage_payments'
  | 'manage_emergencies'
  | 'view_reports'
  | 'manage_services'
  | 'manage_chat'
  | 'manage_settings';

export interface IUser extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'admin' | 'subadmin' | 'nurse' | 'beneficiary';
  email?: string;
  permissions?: SubAdminPermission[];
  isActive: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  fcmToken?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'subadmin', 'nurse', 'beneficiary'], required: true },
  email: { type: String, trim: true },
  permissions: [{ type: String, enum: [
    'manage_nurses', 'manage_beneficiaries', 'manage_orders', 'manage_payments',
    'manage_emergencies', 'view_reports', 'manage_services', 'manage_chat', 'manage_settings'
  ] }],
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String },
  fcmToken: { type: String },
  lastLoginAt: { type: Date },
}, { timestamps: true, discriminatorKey: 'role' });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
