import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmergencyRequest extends Document {
  beneficiaryId: Types.ObjectId;
  nurseId?: Types.ObjectId;
  type: string;
  description: string;
  lat?: number;
  lng?: number;
  address?: string;
  status: 'pending' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  responseTime?: number;
  dispatchedAt?: Date;
  arrivedAt?: Date;
  resolvedAt?: Date;
  notes?: string;
  feedbackRating?: number;
  emergencyFee?: number;
}

const EmergencyRequestSchema = new Schema<IEmergencyRequest>({
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse' },
  type: { type: String, default: 'medical' },
  description: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  address: { type: String },
  status: { type: String, enum: ['pending', 'dispatched', 'in_progress', 'resolved', 'cancelled'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'high' },
  responseTime: { type: Number },
  dispatchedAt: { type: Date },
  arrivedAt: { type: Date },
  resolvedAt: { type: Date },
  notes: { type: String },
  feedbackRating: { type: Number },
  emergencyFee: { type: Number, default: 5000 },
}, { timestamps: true });

export const EmergencyRequest = mongoose.models.EmergencyRequest || mongoose.model<IEmergencyRequest>('EmergencyRequest', EmergencyRequestSchema);
