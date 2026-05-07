import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface IAppointment extends Document {
  beneficiaryId: Types.ObjectId;
  nurseId: Types.ObjectId;
  serviceId: Types.ObjectId;
  requestId: Types.ObjectId | null;
  scheduledAt: Date;
  duration: number; // in minutes
  status: AppointmentStatus;
  notes: string;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const appointmentSchema = new Schema<IAppointment>(
  {
    beneficiaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المستفيد مطلوب'],
    },
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'Nurse',
      required: [true, 'الممرض مطلوب'],
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'الخدمة مطلوبة'],
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      default: null,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'موعد الموعد مطلوب'],
    },
    duration: {
      type: Number,
      required: [true, 'مدة الموعد مطلوبة'],
      min: [5, 'المدة يجب أن تكون 5 دقائق على الأقل'],
      max: [480, 'المدة يجب أن لا تتجاوز 8 ساعات'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const,
      default: 'scheduled',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'الملاحظات يجب أن لا تتجاوز 2000 حرف'],
    },
    reminderSent: {
      type: Boolean,
      default: false,
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
appointmentSchema.index({ nurseId: 1 });
appointmentSchema.index({ beneficiaryId: 1 });
appointmentSchema.index({ scheduledAt: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ nurseId: 1, scheduledAt: 1 });
appointmentSchema.index({ beneficiaryId: 1, scheduledAt: 1 });

// ── Model ───────────────────────────────────────────────────────────
const Appointment: Model<IAppointment> =
  mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', appointmentSchema);

export default Appointment;
