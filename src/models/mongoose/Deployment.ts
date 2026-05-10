import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeployment extends Document {
  // من أنشأ التكليف
  createdBy: Types.ObjectId;
  creatorRole: 'admin' | 'nurse';
  
  // تفاصيل التكليف
  title: string;
  description: string;
  type: 'nursing' | 'lab' | 'midwife' | 'home_care' | 'other';
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
  serviceFee: number;
  totalWithFee: number;
  
  // الحالة
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  
  // المكلف (الممرض المعين)
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;
  
  // المتقدمين
  applications: IDeploymentApplication[];
  
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
  status: 'pending' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: Date;
  
  // إثبات الدفع
  hasPaymentProof: boolean;
  paymentProofData?: string;
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
  status: { 
    type: String, 
    enum: ['pending', 'payment_pending', 'payment_submitted', 'payment_verified', 'accepted', 'rejected'], 
    default: 'pending' 
  },
  appliedAt: { type: Date, default: Date.now },
  hasPaymentProof: { type: Boolean, default: false },
  paymentProofData: { type: String },
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
  
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['nursing', 'lab', 'midwife', 'home_care', 'other'], default: 'nursing' },
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
  serviceFee: { type: Number, default: 0 },
  totalWithFee: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'], 
    default: 'open' 
  },
  
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date },
  
  applications: [DeploymentApplicationSchema],
  
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
