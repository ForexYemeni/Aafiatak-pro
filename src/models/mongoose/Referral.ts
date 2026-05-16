import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  referrerId: Types.ObjectId;
  referredId: Types.ObjectId;
  code: string;
  reward: number;
  status: 'pending' | 'completed' | 'rewarded' | 'expired';
  completedAt?: Date;
}

const ReferralSchema = new Schema<IReferral>({
  referrerId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  referredId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  code: { type: String, required: true },
  reward: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed', 'rewarded', 'expired'], default: 'pending' },
  completedAt: { type: Date },
}, { timestamps: true });

// ── Performance Indexes ──────────────────────────────────────────────
ReferralSchema.index({ referrerId: 1, createdAt: -1 });
ReferralSchema.index({ referredId: 1 });
ReferralSchema.index({ status: 1 });

export const Referral = mongoose.models.Referral || mongoose.model<IReferral>('Referral', ReferralSchema);
