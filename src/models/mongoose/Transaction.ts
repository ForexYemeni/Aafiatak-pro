import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  requestId?: Types.ObjectId;
  emergencyRequestId?: Types.ObjectId;
  beneficiaryId: Types.ObjectId;
  nurseId?: Types.ObjectId;
  amount: number;
  commission: number;
  netAmount: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  walletType?: string;
  notes?: string;
  processedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  requestId: { type: Schema.Types.ObjectId },
  emergencyRequestId: { type: Schema.Types.ObjectId },
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse' },
  amount: { type: Number, required: true },
  commission: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'cash' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  walletType: { type: String },
  notes: { type: String },
  processedAt: { type: Date },
}, { timestamps: true });

export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);
