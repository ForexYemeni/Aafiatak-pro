import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IServiceRequest extends Document {
  serviceId: Types.ObjectId;
  beneficiaryId: Types.ObjectId;
  nurseId?: Types.ObjectId;
  groupId?: string;
  status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'awaiting_payment';
  basePrice: number;
  nightFee: number;
  fridayFee: number;
  emergencyFee: number;
  discount: number;
  totalPrice: number;
  commission: number;
  nursePayout: number;
  beneficiaryLat?: number;
  beneficiaryLng?: number;
  beneficiaryAddress?: string;
  notes?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  isEmergency: boolean;
  isNightService: boolean;
  isFridayService: boolean;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'awaiting_confirmation';
  paymentMethod?: string;
  paymentMethodId?: string;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  couponId?: Types.ObjectId;
}

const ServiceRequestSchema = new Schema<IServiceRequest>({
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse' },
  groupId: { type: String },
  status: { type: String, enum: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'awaiting_payment'], default: 'pending' },
  basePrice: { type: Number, default: 0 },
  nightFee: { type: Number, default: 0 },
  fridayFee: { type: Number, default: 0 },
  emergencyFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  nursePayout: { type: Number, default: 0 },
  beneficiaryLat: { type: Number },
  beneficiaryLng: { type: Number },
  beneficiaryAddress: { type: String },
  notes: { type: String },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
  isEmergency: { type: Boolean, default: false },
  isNightService: { type: Boolean, default: false },
  isFridayService: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded', 'awaiting_confirmation'], default: 'pending' },
  paymentMethod: { type: String },
  paymentMethodId: { type: String },
  hasPaymentProof: { type: Boolean, default: false },
  paymentProofData: { type: String },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
}, { timestamps: true });

ServiceRequestSchema.index({ beneficiaryId: 1 });
ServiceRequestSchema.index({ nurseId: 1 });
ServiceRequestSchema.index({ status: 1 });
ServiceRequestSchema.index({ groupId: 1 });

export const ServiceRequest = mongoose.models.ServiceRequest || mongoose.model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);
