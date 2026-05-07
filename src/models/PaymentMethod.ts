import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type PaymentMethodTypeEnum = 'cash' | 'wallet' | 'card' | 'bank_transfer';
export type WalletTypeEnum = 'flous' | 'zain_cash' | 'mtn_momo' | 'halelflos';

export interface IPaymentMethod extends Document {
  nameAr: string;
  nameEn: string;
  type: PaymentMethodTypeEnum;
  walletType: WalletTypeEnum | null;
  icon: string;
  isActive: boolean;
  instructions: string; // Arabic instructions
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    nameAr: {
      type: String,
      required: [true, 'اسم طريقة الدفع بالعربية مطلوب'],
      trim: true,
      maxlength: [100, 'الاسم يجب أن لا يتجاوز 100 حرف'],
    },
    nameEn: {
      type: String,
      required: [true, 'Payment method name in English is required'],
      trim: true,
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['cash', 'wallet', 'card', 'bank_transfer'] as const,
      required: [true, 'نوع طريقة الدفع مطلوب'],
    },
    walletType: {
      type: String,
      enum: ['flous', 'zain_cash', 'mtn_momo', 'halelflos'] as const,
      default: null,
    },
    icon: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'التعليمات يجب أن لا تتجاوز 2000 حرف'],
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
paymentMethodSchema.index({ type: 1 });
paymentMethodSchema.index({ isActive: 1 });
paymentMethodSchema.index({ walletType: 1 }, { sparse: true });

// ── Model ───────────────────────────────────────────────────────────
const PaymentMethod: Model<IPaymentMethod> =
  mongoose.models.PaymentMethod ||
  mongoose.model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);

export default PaymentMethod;
