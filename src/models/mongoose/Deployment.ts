import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeployment extends Document {
  // من أنشأ التكليف
  createdBy: Types.ObjectId;
  creatorRole: 'admin' | 'nurse';
  creatorPhone?: string;
  
  // تفاصيل التكليف
  title: string;
  description: string;
  type: 'nursing' | 'lab' | 'midwife' | 'home_care' | 'lab_nurse' | 'medical_sector' | 'other';
  gender?: 'male' | 'female';
  department?: string;
  specialization: string[];
  
  // المكان والزمن
  hours: number;
  location: {
    lat?: number;
    lng?: number;
    address?: string;
    governorate?: string;
    district?: string;
  };
  
  // المالية
  amount: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
  creatorServiceFee: number;
  applicantServiceFee: number;
  serviceFee: number; // رسوم التقديم (للمتقدم)
  totalWithFee: number;
  feeResponsible: 'applicant' | 'creator'; // من يتحمل الرسوم
  paymentMethod: string; // طريقة الدفع
  walletNumber: string; // رقم المحفظة
  walletOwnerName: string; // اسم صاحب المحفظة
  
  // الحالة
  status: 'open' | 'creator_selected' | 'admin_approved' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  
  // المكلف (الممرض المعين)
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;
  contactRevealed?: boolean;
  
  // المتقدمين
  applications: IDeploymentApplication[];
  
  // التقييم
  rating?: number;
  ratingComment?: string;
  ratedAt?: Date;
  ratedBy?: Types.ObjectId;
  
  // التواريخ
  startDate?: Date;
  endDate?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  
  // ملاحظات
  requirements?: string;
  notes?: string;
}

export interface IDeploymentApplication {
  applicantId: Types.ObjectId;
  applicantRole: 'nurse' | 'lab_tech' | 'midwife';
  applicantName: string;
  applicantSpecialization?: string[];
  applicantExperience?: number;
  applicantRating?: number;
  applicantCompletedJobs?: number;
  applicantVerificationStatus?: string;
  status: 'pending' | 'selected_by_creator' | 'admin_approved' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: Date;
  
  // إثبات الدفع (صورة)
  hasPaymentProof: boolean;
  paymentProofData?: string;
  paymentProofImage?: string;
  paymentSubmittedAt?: Date;
  paymentVerifiedAt?: Date;
  paymentVerifiedBy?: Types.ObjectId;
  
  // رسوم التقديم
  serviceFee: number;
  
  // ملاحظات
  coverLetter?: string;
  rejectedReason?: string;
}

const DeploymentApplicationSchema = new Schema<IDeploymentApplication>({
  applicantId: { type: Schema.Types.ObjectId, required: true },
  applicantRole: { type: String, enum: ['nurse', 'lab_tech', 'midwife'], required: true },
  applicantName: { type: String, required: true },
  applicantSpecialization: [{ type: String }],
  applicantExperience: { type: Number },
  applicantRating: { type: Number },
  applicantCompletedJobs: { type: Number },
  applicantVerificationStatus: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'selected_by_creator', 'admin_approved', 'payment_pending', 'payment_submitted', 'payment_verified', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  appliedAt: { type: Date, default: Date.now },
  hasPaymentProof: { type: Boolean, default: false },
  paymentProofData: { type: String },
  paymentProofImage: { type: String },
  paymentSubmittedAt: { type: Date },
  paymentVerifiedAt: { type: Date },
  paymentVerifiedBy: { type: Schema.Types.ObjectId },
  serviceFee: { type: Number, default: 0 },
  coverLetter: { type: String },
  rejectedReason: { type: String },
}, { _id: true });

const DeploymentSchema = new Schema<IDeployment>({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  creatorRole: { type: String, enum: ['admin', 'nurse'], required: true },
  creatorPhone: { type: String },
  
  title: { type: String, trim: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['nursing', 'lab', 'midwife', 'home_care', 'lab_nurse', 'medical_sector', 'other'], default: 'nursing' },
  gender: { type: String, enum: ['male', 'female'] },
  department: { type: String },
  specialization: [{ type: String }],
  
  hours: { type: Number, required: true, min: 1 },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
    governorate: { type: String },
    district: { type: String },
  },
  
  amount: { type: Number, required: true, min: 0 },
  adminCommissionPercent: { type: Number, default: 0 },
  adminCommissionAmount: { type: Number, default: 0 },
  creatorServiceFee: { type: Number, default: 0 },
  applicantServiceFee: { type: Number, default: 0 },
  serviceFee: { type: Number, default: 0 },
  totalWithFee: { type: Number, default: 0 },
  feeResponsible: { type: String, enum: ['applicant', 'creator'], default: 'applicant' },
  paymentMethod: { type: String, default: '' },
  walletNumber: { type: String, default: '' },
  walletOwnerName: { type: String, default: '' },
  
  status: { 
    type: String, 
    enum: ['open', 'creator_selected', 'admin_approved', 'assigned', 'in_progress', 'completed', 'cancelled'], 
    default: 'open' 
  },
  
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  contactRevealed: { type: Boolean, default: false },
  
  applications: [DeploymentApplicationSchema],
  
  rating: { type: Number, min: 1, max: 5 },
  ratingComment: { type: String },
  ratedAt: { type: Date },
  ratedBy: { type: Schema.Types.ObjectId },
  
  startDate: { type: Date },
  endDate: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  
  requirements: { type: String },
  notes: { type: String },
}, { timestamps: true });

// Indexes
DeploymentSchema.index({ createdBy: 1 });
DeploymentSchema.index({ status: 1 });
DeploymentSchema.index({ type: 1 });
DeploymentSchema.index({ 'location.governorate': 1 });
DeploymentSchema.index({ createdAt: -1 });

export const Deployment = mongoose.models.Deployment || mongoose.model<IDeployment>('Deployment', DeploymentSchema);
