import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type Platform = 'web' | 'android' | 'ios';

export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  /** Web Push: subscription endpoint. FCM: unused (empty string). */
  endpoint: string;
  /** Web Push: p256dh key. FCM: unused (empty string). */
  p256dh: string;
  /** Web Push: auth key. FCM: unused (empty string). */
  auth: string;
  /** FCM device token (for android/ios). Empty for web platform. */
  fcmToken: string;
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
      default: '',
      trim: true,
    },
    p256dh: {
      type: String,
      default: '',
      trim: true,
    },
    auth: {
      type: String,
      default: '',
      trim: true,
    },
    fcmToken: {
      type: String,
      default: '',
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
// Index for cleanup of expired subscriptions
fcmTokenSchema.index({ endpoint: 1 });
fcmTokenSchema.index({ fcmToken: 1 });
fcmTokenSchema.index({ userId: 1, isActive: 1 });
fcmTokenSchema.index({ platform: 1, isActive: 1 });
// Compound index for fast lookup per user per device (NOT unique — same device
// can have push subscriptions for multiple users on the same browser)
fcmTokenSchema.index({ userId: 1, deviceId: 1 });

// ── Model ───────────────────────────────────────────────────────────
const FCMToken: Model<IFCMToken> =
  mongoose.models.FCMToken || mongoose.model<IFCMToken>('FCMToken', fcmTokenSchema);

export default FCMToken;
