import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'admin' | 'subadmin' | 'nurse' | 'beneficiary';
  isActive: boolean;
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
  isActive: { type: Boolean, default: true },
  fcmToken: { type: String },
  lastLoginAt: { type: Date },
}, { timestamps: true, discriminatorKey: 'role' });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
