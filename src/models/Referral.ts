import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IReferralReward {
  referrerPoints: number;
  referredPoints: number;
}

export type ReferralStatus = 'pending' | 'completed' | 'expired';

export interface IReferral extends Document {
  referrerId: Types.ObjectId;
  referredId: Types.ObjectId;
  code: string;
  reward: IReferralReward;
  status: ReferralStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const referralRewardSchema = new Schema<IReferralReward>(
  {
    referrerPoints: {
      type: Number,
      required: true,
      min: [0, 'نقاط المُحيل لا يمكن أن تكون أقل من 0'],
    },
    referredPoints: {
      type: Number,
      required: true,
      min: [0, 'نقاط المُحال لا يمكن أن تكون أقل من 0'],
    },
  },
  { _id: false }
);

const referralSchema = new Schema<IReferral>(
  {
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المُحيل مطلوب'],
    },
    referredId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المُحال مطلوب'],
    },
    code: {
      type: String,
      required: [true, 'كود الإحالة مطلوب'],
      trim: true,
      uppercase: true,
    },
    reward: {
      type: referralRewardSchema,
      required: [true, 'المكافأة مطلوبة'],
      default: () => ({ referrerPoints: 50, referredPoints: 50 }),
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'] as const,
      default: 'pending',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ─────────────────────────────────────────────────────────
referralSchema.index({ code: 1 });
referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredId: 1 });
referralSchema.index({ referrerId: 1, referredId: 1 }, { unique: true });

// ── Model ───────────────────────────────────────────────────────────
const Referral: Model<IReferral> =
  mongoose.models.Referral || mongoose.model<IReferral>('Referral', referralSchema);

export default Referral;
