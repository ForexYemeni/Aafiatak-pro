import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IGeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type EmergencyType = 'medical' | 'accident' | 'child_emergency' | 'elderly_emergency' | 'other';
export type EmergencyStatus = 'pending' | 'assigned' | 'on_the_way' | 'in_progress' | 'resolved' | 'cancelled';

export interface IEmergencyRequest extends Document {
  beneficiaryId: Types.ObjectId;
  nurseId: Types.ObjectId | null;
  type: EmergencyType;
  description: string;
  location: IGeoJSONPoint;
  address: string;
  status: EmergencyStatus;
  responseTime: number | null; // in seconds
  resolvedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const emergencyRequestSchema = new Schema<IEmergencyRequest>(
  {
    beneficiaryId: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      required: [true, 'المستفيد مطلوب'],
    },
    nurseId: {
      type: Schema.Types.ObjectId,
      ref: 'Nurse',
      default: null,
    },
    type: {
      type: String,
      enum: ['medical', 'accident', 'child_emergency', 'elderly_emergency', 'other'] as const,
      required: [true, 'نوع الطوارئ مطلوب'],
    },
    description: {
      type: String,
      required: [true, 'الوصف مطلوب'],
      trim: true,
      maxlength: [2000, 'الوصف يجب أن لا يتجاوز 2000 حرف'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'] as const,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
        validate: {
          validator: function (v: number[]): boolean {
            return v.length === 2;
          },
          message: 'الإحداثيات يجب أن تكون [خط الطول، دائرة العرض]',
        },
      },
    },
    address: {
      type: String,
      required: [true, 'العنوان مطلوب'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'on_the_way', 'in_progress', 'resolved', 'cancelled'] as const,
      default: 'pending',
    },
    responseTime: {
      type: Number,
      default: null,
      min: [0, 'وقت الاستجابة لا يمكن أن يكون أقل من 0'],
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
emergencyRequestSchema.index({ status: 1 });
emergencyRequestSchema.index({ type: 1 });
emergencyRequestSchema.index({ createdAt: -1 });
emergencyRequestSchema.index({ location: '2dsphere' });
emergencyRequestSchema.index({ beneficiaryId: 1 });
// TTL index: auto-cleanup resolved/cancelled emergency requests after 24 hours
emergencyRequestSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 86400,
    partialFilterExpression: { status: { $in: ['resolved', 'cancelled'] } },
  }
);

// ── Model ───────────────────────────────────────────────────────────
const EmergencyRequest: Model<IEmergencyRequest> =
  mongoose.models.EmergencyRequest ||
  mongoose.model<IEmergencyRequest>('EmergencyRequest', emergencyRequestSchema);

export default EmergencyRequest;
