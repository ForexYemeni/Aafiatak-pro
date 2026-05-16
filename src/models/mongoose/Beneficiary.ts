import mongoose, { Schema, Document, Types } from 'mongoose';
import { User } from './User';

export interface IBeneficiary extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'beneficiary';
  referralCode: string;
  referredBy?: Types.ObjectId;
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
  referredBy: { type: Schema.Types.ObjectId, ref: 'Beneficiary' },
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

// ── Performance Indexes ──────────────────────────────────────────────
  BeneficiarySchema.index({ governorate: 1 });
  BeneficiarySchema.index({ loyaltyTier: 1, loyaltyPoints: -1 });
  BeneficiarySchema.index({ referredBy: 1 });
  BeneficiarySchema.index({ referralCode: 1 }, { unique: true });

  // Safe discriminator registration - prevents "Discriminator with name already exists" error
function getBeneficiaryModel() {
  // Check if model already exists in mongoose.models
  if (mongoose.models.Beneficiary) {
    return mongoose.models.Beneficiary;
  }
  // Check if discriminator already registered
  if (User.discriminators && User.discriminators['beneficiary']) {
    return User.discriminators['beneficiary'];
  }
  // Register new discriminator
  return User.discriminator('beneficiary', BeneficiarySchema);
}

export const Beneficiary = getBeneficiaryModel();
