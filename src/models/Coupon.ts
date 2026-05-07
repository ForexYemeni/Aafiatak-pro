import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export interface ICoupon extends Document {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  minOrderAmount: number;
  expiresAt: Date;
  isActive: boolean;
  applicableServices: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, 'كود الكوبون مطلوب'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'كود الكوبون يجب أن يكون 3 أحرف على الأقل'],
      maxlength: [30, 'كود الكوبون يجب أن لا يتجاوز 30 حرف'],
      match: [/^[A-Z0-9]+$/, 'كود الكوبون يجب أن يحتوي على أحرف إنجليزية وأرقام فقط'],
    },
    discountPercent: {
      type: Number,
      required: [true, 'نسبة الخصم مطلوبة'],
      min: [1, 'نسبة الخصم يجب أن تكون 1% على الأقل'],
      max: [100, 'نسبة الخصم يجب أن لا تتجاوز 100%'],
    },
    maxUses: {
      type: Number,
      required: [true, 'الحد الأقصى للاستخدام مطلوب'],
      min: [1, 'الحد الأقصى للاستخدام يجب أن يكون 1 على الأقل'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'عدد الاستخدامات لا يمكن أن يكون أقل من 0'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'الحد الأدنى للطلب لا يمكن أن يكون أقل من 0'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'تاريخ الانتهاء مطلوب'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableServices: {
      type: [Schema.Types.ObjectId],
      ref: 'Service',
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'منشئ الكوبون مطلوب'],
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
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ expiresAt: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ isActive: 1, expiresAt: 1 });

// ── Validation: expiresAt must be in the future ─────────────────────
couponSchema.path('expiresAt').validate(function (v: Date): boolean {
  return v > new Date();
}, 'تاريخ الانتهاء يجب أن يكون في المستقبل');

// ── Model ───────────────────────────────────────────────────────────
const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', couponSchema);

export default Coupon;
