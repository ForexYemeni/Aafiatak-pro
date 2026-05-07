import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type TransactionPaymentMethod = 'cash' | 'wallet' | 'card' | 'loyalty_points' | 'bank_transfer';

export interface ITransaction extends Document {
  requestId: Types.ObjectId;
  beneficiaryId: Types.ObjectId;
  nurseId: Types.ObjectId;
  amount: number;
  commission: number;
  netAmount: number;
  paymentMethod: TransactionPaymentMethod;
  paymentDetails: Record<string, unknown>;
  status: TransactionStatus;
  processedAt: Date | null;
  refundReason: string;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const transactionSchema = new Schema<ITransaction>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      required: [true, 'طلب الخدمة مطلوب'],
    },
    beneficiaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المستفيد مطلوب'],
    },
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'Nurse',
      required: [true, 'الممرض مطلوب'],
    },
    amount: {
      type: Number,
      required: [true, 'المبلغ مطلوب'],
      min: [0, 'المبلغ لا يمكن أن يكون أقل من 0'],
    },
    commission: {
      type: Number,
      required: [true, 'العمولة مطلوبة'],
      min: [0, 'العمولة لا يمكن أن تكون أقل من 0'],
    },
    netAmount: {
      type: Number,
      required: [true, 'صافي المبلغ مطلوب'],
      min: [0, 'صافي المبلغ لا يمكن أن يكون أقل من 0'],
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'wallet', 'card', 'loyalty_points', 'bank_transfer'] as const,
      required: [true, 'طريقة الدفع مطلوبة'],
    },
    paymentDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'] as const,
      default: 'pending',
    },
    processedAt: {
      type: Date,
      default: null,
    },
    refundReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'سبب الاسترداد يجب أن لا يتجاوز 1000 حرف'],
    },
    refundedAt: {
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
transactionSchema.index({ beneficiaryId: 1 });
transactionSchema.index({ nurseId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ requestId: 1 }, { unique: true });
transactionSchema.index({ paymentMethod: 1 });

// ── Model ───────────────────────────────────────────────────────────
const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
