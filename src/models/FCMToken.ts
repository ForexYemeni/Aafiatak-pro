import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type Platform = 'web' | 'android' | 'ios';

export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  token: string;
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
    },
    token: {
      type: String,
      required: [true, 'رمز FCM مطلوب'],
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'] as const,
      required: [true, 'المنصة مطلوبة'],
    },
    deviceId: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
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
fcmTokenSchema.index({ userId: 1 });
fcmTokenSchema.index({ token: 1 }, { unique: true });
fcmTokenSchema.index({ isActive: 1 });
fcmTokenSchema.index({ userId: 1, isActive: 1 });

// ── Model ───────────────────────────────────────────────────────────
const FCMToken: Model<IFCMToken> =
  mongoose.models.FCMToken || mongoose.model<IFCMToken>('FCMToken', fcmTokenSchema);

export default FCMToken;
