import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmergencyRequest extends Document {
  beneficiaryId: Types.ObjectId;
  nurseId?: Types.ObjectId;
  type: string;
  description: string;
  lat?: number;
  lng?: number;
  address?: string;
  status: 'pending' | 'dispatched' | 'accepted' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  responseTime?: number;
  dispatchedAt?: Date;
  arrivedAt?: Date;
  resolvedAt?: Date;
  notes?: string;
  outcome?: 'treated_on_site' | 'transferred_to_hospital' | 'refused_treatment' | 'other';
  resolvedNotes?: string;
  feedbackRating?: number;
  emergencyFee?: number;
  paymentMethod?: string;
  paymentMethodId?: string;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  paymentStatus?: 'pending' | 'paid' | 'verified' | 'rejected';
}

const EmergencyRequestSchema = new Schema<IEmergencyRequest>({
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse' },
  type: { type: String, default: 'medical' },
  description: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  address: { type: String },
  status: { type: String, enum: ['pending', 'dispatched', 'accepted', 'in_progress', 'resolved', 'cancelled'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'high' },
  responseTime: { type: Number },
  dispatchedAt: { type: Date },
  arrivedAt: { type: Date },
  resolvedAt: { type: Date },
  notes: { type: String },
  outcome: { type: String, enum: ['treated_on_site', 'transferred_to_hospital', 'refused_treatment', 'other'] },
  resolvedNotes: { type: String },
  feedbackRating: { type: Number },
  emergencyFee: { type: Number, default: 5000 },
  paymentMethod: { type: String, default: 'cash' },
  paymentMethodId: { type: String },
  hasPaymentProof: { type: Boolean, default: false },
  paymentProofData: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'verified', 'rejected'], default: 'pending' },
}, { timestamps: true });

// ── Performance Indexes ──────────────────────────────────────────────
  EmergencyRequestSchema.index({ status: 1, createdAt: -1 });
  EmergencyRequestSchema.index({ beneficiaryId: 1, createdAt: -1 });
  EmergencyRequestSchema.index({ nurseId: 1, status: 1 });
  EmergencyRequestSchema.index({ priority: 1, status: 1 });
  EmergencyRequestSchema.index({ paymentStatus: 1 });

  export const EmergencyRequest = mongoose.models.EmergencyRequest || mongoose.model<IEmergencyRequest>('EmergencyRequest', EmergencyRequestSchema);
