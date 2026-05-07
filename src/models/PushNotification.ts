import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type NotificationType =
  | 'service_request'
  | 'service_update'
  | 'emergency'
  | 'payment'
  | 'promotion'
  | 'chat'
  | 'rating'
  | 'system'
  | 'loyalty'
  | 'referral';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface IPushNotification extends Document {
  userId: Types.ObjectId;
  title: string;
  body: string; // Arabic
  type: NotificationType;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const pushNotificationSchema = new Schema<IPushNotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'معرف المستخدم مطلوب'],
    },
    title: {
      type: String,
      required: [true, 'عنوان الإشعار مطلوب'],
      trim: true,
      maxlength: [200, 'العنوان يجب أن لا يتجاوز 200 حرف'],
    },
    body: {
      type: String,
      required: [true, 'محتوى الإشعار مطلوب'],
      trim: true,
      maxlength: [2000, 'المحتوى يجب أن لا يتجاوز 2000 حرف'],
    },
    type: {
      type: String,
      enum: [
        'service_request',
        'service_update',
        'emergency',
        'payment',
        'promotion',
        'chat',
        'rating',
        'system',
        'loyalty',
        'referral',
      ] as const,
      required: [true, 'نوع الإشعار مطلوب'],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'] as const,
      default: 'normal',
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, // Only createdAt
  }
);

// Override toJSON to remove __v
pushNotificationSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Add createdAt manually since timestamps is false
pushNotificationSchema.add({
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Indexes ─────────────────────────────────────────────────────────
pushNotificationSchema.index({ userId: 1 });
pushNotificationSchema.index({ read: 1 });
pushNotificationSchema.index({ type: 1 });
pushNotificationSchema.index({ createdAt: -1 });
pushNotificationSchema.index({ userId: 1, read: 1 });
pushNotificationSchema.index({ userId: 1, createdAt: -1 });

// ── Model ───────────────────────────────────────────────────────────
const PushNotification: Model<IPushNotification> =
  mongoose.models.PushNotification ||
  mongoose.model<IPushNotification>('PushNotification', pushNotificationSchema);

export default PushNotification;
