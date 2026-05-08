import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  nurseId: Types.ObjectId;
  nurseName: string;
  nursePhone: string;
  amount: number;
  withdrawalFee: number;
  netAmount: number;
  walletType: string;
  walletNumber: string;
  walletHolderName: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  adminNotes?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  rejectedReason?: string;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>({
  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse', required: true, index: true },
  nurseName: { type: String, required: true },
  nursePhone: { type: String, required: true },
  amount: { type: Number, required: true },
  withdrawalFee: { type: Number, required: true, default: 200 },
  netAmount: { type: Number, required: true },
  walletType: { type: String, required: true },
  walletNumber: { type: String, required: true },
  walletHolderName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'processed'], default: 'pending', index: true },
  adminNotes: { type: String },
  processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
  rejectedReason: { type: String },
}, { timestamps: true });

export const WithdrawalRequest = mongoose.models.WithdrawalRequest || mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
