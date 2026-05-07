import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  userRole: string;
  action: string;
  entity?: string;
  entityId?: Types.ObjectId;
  details?: string;
  ipAddress?: string;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  userId: { type: Schema.Types.ObjectId, required: true },
  userRole: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String },
  entityId: { type: Schema.Types.ObjectId },
  details: { type: String },
  ipAddress: { type: String },
}, { timestamps: true });

ActivityLogSchema.index({ userId: 1 });
ActivityLogSchema.index({ action: 1 });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
