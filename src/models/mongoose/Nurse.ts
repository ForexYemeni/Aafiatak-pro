import mongoose, { Schema, Document } from 'mongoose';
import { User } from './User';

// ---- Skill Sub-schema ----
const SkillSchema = new Schema({
  name: { type: String, required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'intermediate' },
  order: { type: Number, default: 0 },
}, { _id: false });

// ---- Experience Sub-schema ----
const ExperienceSchema = new Schema({
  facility: { type: String },       // جهة العمل
  title: { type: String },          // المسمى الوظيفي
  duration: { type: String },       // مدة العمل
  description: { type: String },    // وصف المهام
  casesType: { type: String },      // نوع الحالات
  startDate: { type: Date },
  endDate: { type: Date },
  order: { type: Number, default: 0 },
}, { _id: false });

// ---- Certificate Sub-schema ----
const CertificateSchema = new Schema({
  name: { type: String, required: true },    // اسم الشهادة
  issuer: { type: String },                   // الجهة المانحة
  date: { type: String },                     // تاريخ الحصول
  type: { type: String, enum: ['certificate', 'course', 'license', 'training'], default: 'certificate' },
  verified: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { _id: false });

// ---- Language Sub-schema ----
const LanguageSchema = new Schema({
  name: { type: String, required: true },
  level: { type: String, enum: ['native', 'fluent', 'advanced', 'intermediate', 'basic'], default: 'intermediate' },
}, { _id: false });

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
  // New CV fields
  skills: { name: string; level: string; order: number }[];
  experiences: {
    facility?: string; title?: string; duration?: string;
    description?: string; casesType?: string;
    startDate?: Date; endDate?: Date; order: number;
  }[];
  certificates: {
    name: string; issuer?: string; date?: string;
    type: string; verified: boolean; order: number;
  }[];
  languages: { name: string; level: string }[];
  professionalTitle?: string;
  emergencyCases: number;
  responseRate: number;
  complianceRate: number;
  avatar?: string;
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
  // New CV fields
  skills: [SkillSchema],
  experiences: [ExperienceSchema],
  certificates: [CertificateSchema],
  languages: [LanguageSchema],
  professionalTitle: { type: String, default: '' },
  emergencyCases: { type: Number, default: 0 },
  responseRate: { type: Number, default: 0 },
  complianceRate: { type: Number, default: 0 },
  avatar: { type: String },
});

// ── Performance Indexes ──────────────────────────────────────────────
  NurseSchema.index({ verificationStatus: 1, isActive: 1 });
  NurseSchema.index({ isAvailable: 1, isOnline: 1 });
  NurseSchema.index({ governorate: 1, verificationStatus: 1 });
  NurseSchema.index({ rating: -1, completedJobs: -1 });

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
