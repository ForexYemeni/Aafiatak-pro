import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type PaymentMethodTypeEnum = 'wallet_deposit' | 'bank_transfer' | 'cash';
export type WalletTypeEnum =
  | 'jeep' | 'jawali' | 'cash_wallet' | 'one_cash' | 'flousk'
  | 'saba_cash' | 'balh' | 'tadawul' | 'cashq' | 'yomni'
  | 'payos' | 'zain_cash' | 'mubashir' | 'rafid' | 'amwal'
  | 'salaf' | 'halelflos' | 'yemen_wallet';
export type ExchangeTypeEnum =
  | 'al_najm' | 'yemen_express' | 'al_imtiaz' | 'al_hazmi'
  | 'al_kabsi' | 'shamsan' | 'al_taiseer' | 'al_amal'
  | 'al_thiqa' | 'al_safi' | 'al_rashid' | 'al_baraka';

export interface IPaymentMethod extends Document {
  nameAr: string;
  nameEn: string;
  type: PaymentMethodTypeEnum;
  walletType: WalletTypeEnum | null;
  exchangeType: ExchangeTypeEnum | null;
  icon: string;
  isActive: boolean;
  instructions: string;
  accountName: string;
  accountNumber: string;
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
      enum: ['wallet_deposit', 'bank_transfer', 'cash'] as const,
      required: [true, 'نوع طريقة الدفع مطلوب'],
    },
    walletType: {
      type: String,
      enum: [
        'jeep', 'jawali', 'cash_wallet', 'one_cash', 'flousk',
        'saba_cash', 'balh', 'tadawul', 'cashq', 'yomni',
        'payos', 'zain_cash', 'mubashir', 'rafid', 'amwal',
        'salaf', 'halelflos', 'yemen_wallet',
      ] as const,
      default: null,
    },
    exchangeType: {
      type: String,
      enum: [
        'al_najm', 'yemen_express', 'al_imtiaz', 'al_hazmi',
        'al_kabsi', 'shamsan', 'al_taiseer', 'al_amal',
        'al_thiqa', 'al_safi', 'al_rashid', 'al_baraka',
      ] as const,
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
    accountName: {
      type: String,
      default: '',
      trim: true,
    },
    accountNumber: {
      type: String,
      default: '',
      trim: true,
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
paymentMethodSchema.index({ exchangeType: 1 }, { sparse: true });

// ── Model ───────────────────────────────────────────────────────────
const PaymentMethod: Model<IPaymentMethod> =
  mongoose.models.PaymentMethod ||
  mongoose.model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);

export default PaymentMethod;
