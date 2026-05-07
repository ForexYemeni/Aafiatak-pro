import mongoose, { Schema, Document } from 'mongoose';
import { User } from './User';

export interface IBeneficiary extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'beneficiary';
  referralCode: string;
  referredBy?: string;
  address?: string;
  city?: string;
  governorate?: string;
  district?: string;
  lat?: number;
  lng?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateOfBirth?: Date;
  gender?: string;
  bloodType?: string;
  medicalConditions: string[];
  allergies: string[];
  loyaltyPoints: number;
  loyaltyTier: string;
  totalSpent: number;
  orderCount: number;
  isActive: boolean;
}

const BeneficiarySchema = new Schema({
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: String },
  address: { type: String },
  city: { type: String },
  governorate: { type: String },
  district: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  emergencyContactName: { type: String },
  emergencyContactPhone: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female'] },
  bloodType: { type: String },
  medicalConditions: [{ type: String }],
  allergies: [{ type: String }],
  loyaltyPoints: { type: Number, default: 0 },
  loyaltyTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  totalSpent: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
});

// Prevent duplicate discriminator on hot reload
export const Beneficiary = (mongoose.models.Beneficiary ||
  (User.discriminators && User.discriminators['beneficiary'])
) as ReturnType<typeof User.discriminator>;

if (!mongoose.models.Beneficiary && !(User.discriminators && User.discriminators['beneficiary'])) {
  User.discriminator('beneficiary', BeneficiarySchema);
}

const _BeneficiaryModel = mongoose.models.Beneficiary;
