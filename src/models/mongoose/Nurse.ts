import mongoose, { Schema, Document } from 'mongoose';
import { User } from './User';

export interface INurse extends Document {
  name: string;
  phone: string;
  password: string;
  role: 'nurse';
  specialization: string[];
  licenseNumber?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
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
  governorate?: string;
  district?: string;
  address?: string;
  walletType?: string;
  walletNumber?: string;
  identityDocumentUrl?: string;
  licenseDocumentUrl?: string;
  rejectedReason?: string;
  isActive: boolean;
}

const NurseSchema = new Schema({
  specialization: [{ type: String }],
  licenseNumber: { type: String },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
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
  governorate: { type: String },
  district: { type: String },
  address: { type: String },
  walletType: { type: String },
  walletNumber: { type: String },
  identityDocumentUrl: { type: String },
  licenseDocumentUrl: { type: String },
  rejectedReason: { type: String },
});

export const Nurse = mongoose.models.Nurse || User.discriminator('nurse', NurseSchema);
