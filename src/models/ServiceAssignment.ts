import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'completed';

export interface IServiceAssignment extends Document {
  requestId: Types.ObjectId;
  nurseId: Types.ObjectId;
  status: AssignmentStatus;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  respondedAt: Date | null;
  responseNote: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const serviceAssignmentSchema = new Schema<IServiceAssignment>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      required: [true, 'طلب الخدمة مطلوب'],
    },
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'Nurse',
      required: [true, 'الممرض مطلوب'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired', 'completed'] as const,
      default: 'pending',
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      required: [true, 'مُعين الطلب مطلوب'],
      refPath: 'assignedByModel',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    responseNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'ملاحظة الرد يجب أن لا تتجاوز 1000 حرف'],
    },
    completedAt: {
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

// ── Virtual for polymorphic assignedBy reference ────────────────────
serviceAssignmentSchema.virtual('assignedByModel').get(function (): string {
  // Determine model based on the role of the assigning user
  // This is set dynamically; default to Admin
  return 'Admin';
});

// ── Indexes ─────────────────────────────────────────────────────────
serviceAssignmentSchema.index({ nurseId: 1 });
serviceAssignmentSchema.index({ status: 1 });
serviceAssignmentSchema.index({ requestId: 1, nurseId: 1 }, { unique: true });
serviceAssignmentSchema.index({ assignedBy: 1 });

// ── Model ───────────────────────────────────────────────────────────
const ServiceAssignment: Model<IServiceAssignment> =
  mongoose.models.ServiceAssignment ||
  mongoose.model<IServiceAssignment>('ServiceAssignment', serviceAssignmentSchema);

export default ServiceAssignment;
