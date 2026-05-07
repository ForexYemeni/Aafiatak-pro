import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type EmergencyAssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'arrived' | 'resolved' | 'expired';

export interface IEmergencyAssignment extends Document {
  emergencyRequestId: Types.ObjectId;
  nurseId: Types.ObjectId;
  status: EmergencyAssignmentStatus;
  assignedAt: Date;
  respondedAt: Date | null;
  arrivedAt: Date | null;
  resolvedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const emergencyAssignmentSchema = new Schema<IEmergencyAssignment>(
  {
    emergencyRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'EmergencyRequest',
      required: [true, 'طلب الطوارئ مطلوب'],
    },
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'Nurse',
      required: [true, 'الممرض مطلوب'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'arrived', 'resolved', 'expired'] as const,
      default: 'pending',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    arrivedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'الملاحظات يجب أن لا تتجاوز 2000 حرف'],
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
emergencyAssignmentSchema.index({ emergencyRequestId: 1, nurseId: 1 }, { unique: true });
emergencyAssignmentSchema.index({ nurseId: 1, status: 1 });
emergencyAssignmentSchema.index({ status: 1 });

// ── Model ───────────────────────────────────────────────────────────
const EmergencyAssignment: Model<IEmergencyAssignment> =
  mongoose.models.EmergencyAssignment ||
  mongoose.model<IEmergencyAssignment>('EmergencyAssignment', emergencyAssignmentSchema);

export default EmergencyAssignment;
