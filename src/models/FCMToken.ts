import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type Platform = 'web' | 'android' | 'ios';

export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: Platform;
  deviceId: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const fcmTokenSchema = new Schema<IFCMToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'معرف المستخدم مطلوب'],
      index: true,
    },
    endpoint: {
      type: String,
      required: [true, 'رابط الاشتراك مطلوب'],
      trim: true,
    },
    p256dh: {
      type: String,
      required: [true, 'مفتاح التشفير مطلوب'],
      trim: true,
    },
    auth: {
      type: String,
      required: [true, 'مفتاح المصادقة مطلوب'],
      trim: true,
    },
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'] as const,
      default: 'web',
    },
    deviceId: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
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
// Compound index: one active subscription per device per user
fcmTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
// Index for cleanup of expired subscriptions
fcmTokenSchema.index({ endpoint: 1 });
fcmTokenSchema.index({ userId: 1, isActive: 1 });

// ── Model ───────────────────────────────────────────────────────────
const FCMToken: Model<IFCMToken> =
  mongoose.models.FCMToken || mongoose.model<IFCMToken>('FCMToken', fcmTokenSchema);

export default FCMToken;
