import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type UserRole = 'admin' | 'subadmin' | 'nurse' | 'beneficiary';

export interface IActivityLog extends Document {
  userId: Types.ObjectId;
  userRole: UserRole;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  createdAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, 'معرف المستخدم مطلوب'],
    },
    userRole: {
      type: String,
      enum: ['admin', 'subadmin', 'nurse', 'beneficiary'] as const,
      required: [true, 'دور المستخدم مطلوب'],
    },
    action: {
      type: String,
      required: [true, 'الإجراء مطلوب'],
      trim: true,
      maxlength: [200, 'الإجراء يجب أن لا يتجاوز 200 حرف'],
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
    },
    deviceFingerprint: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: false, // ActivityLog only has createdAt
  }
);

// Override toJSON to remove __v
activityLogSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Add createdAt manually since timestamps is false
activityLogSchema.add({
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Indexes ─────────────────────────────────────────────────────────
activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

// ── Model ───────────────────────────────────────────────────────────
const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

export default ActivityLog;
