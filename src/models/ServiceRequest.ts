import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IPricing {
  basePrice: number;
  nightFee: number;
  fridayFee: number;
  emergencyFee: number;
  discount: number;
  totalPrice: number;
  commission: number;
  nurseEarnings: number;
}

export interface IGeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type ServiceRequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type PaymentMethodType = 'cash' | 'wallet' | 'card' | 'loyalty_points';
export type PaymentStatusType = 'pending' | 'paid' | 'refunded' | 'failed';

export interface IServiceRequest extends Document {
  serviceId: Types.ObjectId;
  beneficiaryId: Types.ObjectId;
  nurseId: Types.ObjectId | null;
  status: ServiceRequestStatus;
  pricing: IPricing;
  location: IGeoJSONPoint;
  address: string;
  notes: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancellationReason: string;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatusType;
  couponId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const pricingSchema = new Schema<IPricing>(
  {
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    nightFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    fridayFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    emergencyFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    nurseEarnings: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'الخدمة مطلوبة'],
    },
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
    status: {
      type: String,
      enum: [
        'pending',
        'assigned',
        'accepted',
        'on_the_way',
        'in_progress',
        'completed',
        'cancelled',
        'disputed',
      ] as const,
      default: 'pending',
    },
    pricing: {
      type: pricingSchema,
      required: [true, 'التسعير مطلوب'],
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
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'الملاحظات يجب أن لا تتجاوز 2000 حرف'],
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'wallet', 'card', 'loyalty_points'] as const,
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'] as const,
      default: 'pending',
    },
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
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
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ beneficiaryId: 1 });
serviceRequestSchema.index({ nurseId: 1 });
serviceRequestSchema.index({ createdAt: -1 });
serviceRequestSchema.index({ location: '2dsphere' });
serviceRequestSchema.index({ scheduledAt: 1 });

// ── Model ───────────────────────────────────────────────────────────
const ServiceRequest: Model<IServiceRequest> =
  mongoose.models.ServiceRequest ||
  mongoose.model<IServiceRequest>('ServiceRequest', serviceRequestSchema);

export default ServiceRequest;
