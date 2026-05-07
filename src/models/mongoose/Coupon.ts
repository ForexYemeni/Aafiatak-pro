import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  expiresAt: Date;
  isActive: boolean;
  createdById: string;
}

const CouponSchema = new Schema<ICoupon>({
  code: { type: String, required: true, unique: true },
  discountPercent: { type: Number, required: true },
  maxUses: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdById: { type: String, required: true },
}, { timestamps: true });

export const Coupon = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);
