import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  userRole: string;
  titleAr: string;
  bodyAr: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: Record<string, any>;
  read: boolean;
  actionUrl?: string;
  voiceEnabled: boolean;
  voicePlayedAt?: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, required: true },
  userRole: { type: String, required: true },
  titleAr: { type: String, required: true },
  bodyAr: { type: String, required: true },
  type: { type: String, default: 'system' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  data: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  actionUrl: { type: String },
  voiceEnabled: { type: Boolean, default: true },
  voicePlayedAt: { type: Date },
}, { timestamps: true });

NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ read: 1 });

export const Notification = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
