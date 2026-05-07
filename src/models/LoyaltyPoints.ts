import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type LoyaltyPointsType = 'earn' | 'redeem' | 'expire' | 'bonus';

export interface ILoyaltyPoints extends Document {
  beneficiaryId: Types.ObjectId;
  points: number;
  type: LoyaltyPointsType;
  referenceId: Types.ObjectId | null;
  description: string;
  expiresAt: Date | null;
  createdAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const loyaltyPointsSchema = new Schema<ILoyaltyPoints>(
  {
    beneficiaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المستفيد مطلوب'],
    },
    points: {
      type: Number,
      required: [true, 'عدد النقاط مطلوب'],
      min: [1, 'عدد النقاط يجب أن يكون 1 على الأقل'],
    },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'expire', 'bonus'] as const,
      required: [true, 'نوع النقاط مطلوب'],
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'الوصف يجب أن لا يتجاوز 500 حرف'],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, // Only createdAt
  }
);

// Override toJSON to remove __v
loyaltyPointsSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Add createdAt manually since timestamps is false
loyaltyPointsSchema.add({
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Indexes ─────────────────────────────────────────────────────────
loyaltyPointsSchema.index({ beneficiaryId: 1 });
loyaltyPointsSchema.index({ type: 1 });
loyaltyPointsSchema.index({ expiresAt: 1 }, { sparse: true });
loyaltyPointsSchema.index({ beneficiaryId: 1, type: 1 });

// ── Model ───────────────────────────────────────────────────────────
const LoyaltyPoints: Model<ILoyaltyPoints> =
  mongoose.models.LoyaltyPoints ||
  mongoose.model<ILoyaltyPoints>('LoyaltyPoints', loyaltyPointsSchema);

export default LoyaltyPoints;
