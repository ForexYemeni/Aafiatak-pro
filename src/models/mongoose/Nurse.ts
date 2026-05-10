import mongoose, { Schema, Document } from 'mongoose';
import { User } from './User';

export interface INurse extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'nurse';
  specialization: string[];
  licenseNumber?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  isAvailable: boolean;
  isOnline: boolean;
  lat?: number;
  lng?: number;
  locationUpdatedAt?: Date;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  totalEarnings: number;
  availableBalance: number;
  experience: number;
  bio?: string;
  bloodType?: string;
  governorate?: string;
  district?: string;
  address?: string;
  walletType?: string;
  walletNumber?: string;
  identityDocumentUrl?: string;
  licenseDocumentUrl?: string;
  identityDocumentData?: string;
  licenseDocumentData?: string;
  rejectedReason?: string;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string;
}

const NurseSchema = new Schema({
  specialization: [{ type: String }],
  licenseNumber: { type: String },
  verificationStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
  isAvailable: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lat: { type: Number },
  lng: { type: Number },
  locationUpdatedAt: { type: Date },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  experience: { type: Number, default: 0 },
  bio: { type: String },
  bloodType: { type: String },
  governorate: { type: String },
  district: { type: String },
  address: { type: String },
  walletType: { type: String },
  walletNumber: { type: String },
  identityDocumentUrl: { type: String },
  licenseDocumentUrl: { type: String },
  identityDocumentData: { type: String },
  licenseDocumentData: { type: String },
  rejectedReason: { type: String },
  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String },
});

// Safe discriminator registration - prevents "Discriminator with name already exists" error
function getNurseModel() {
  // Check if model already exists in mongoose.models
  if (mongoose.models.Nurse) {
    return mongoose.models.Nurse;
  }
  // Check if discriminator already registered
  if (User.discriminators && User.discriminators['nurse']) {
    return User.discriminators['nurse'];
  }
  // Register new discriminator
  return User.discriminator('nurse', NurseSchema);
}

export const Nurse = getNurseModel();
