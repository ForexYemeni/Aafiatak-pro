import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILoyaltyTransaction extends Document {
  beneficiaryId: Types.ObjectId;
  points: number;
  type: 'earn' | 'redeem' | 'expire' | 'bonus';
  referenceId?: Types.ObjectId;
  description?: string;
  expiresAt?: Date;
}

const LoyaltyTransactionSchema = new Schema<ILoyaltyTransaction>({
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true },
  points: { type: Number, required: true },
  type: { type: String, enum: ['earn', 'redeem', 'expire', 'bonus'], default: 'earn' },
  referenceId: { type: Schema.Types.ObjectId },
  description: { type: String },
  expiresAt: { type: Date },
}, { timestamps: true });

export const LoyaltyTransaction = mongoose.models.LoyaltyTransaction || mongoose.model<ILoyaltyTransaction>('LoyaltyTransaction', LoyaltyTransactionSchema);
