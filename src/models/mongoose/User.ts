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

// Register discriminators for all roles that don't have extra fields
// This is required because Mongoose with discriminatorKey expects a discriminator
// for every possible value of the discriminator key when discriminators are used
function ensureDiscriminator(name: string, schema: Schema = new Schema({})) {
  if (User.discriminators && User.discriminators[name]) {
    return User.discriminators[name];
  }
  if (mongoose.models[name]) {
    return mongoose.models[name];
  }
  return User.discriminator(name, schema);
}

// Admin discriminator (no extra fields)
ensureDiscriminator('admin');

// SubAdmin discriminator (no extra fields - uses base User fields only)
ensureDiscriminator('subadmin');
