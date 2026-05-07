import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type WhatsAppQueueStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface IWhatsAppQueue extends Document {
  to: string;
  template: string;
  params: string[];
  status: WhatsAppQueueStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  failureReason: string;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const whatsAppQueueSchema = new Schema<IWhatsAppQueue>(
  {
    to: {
      type: String,
      required: [true, 'رقم المستلم مطلوب'],
      trim: true,
    },
    template: {
      type: String,
      required: [true, 'اسم القالب مطلوب'],
      trim: true,
      maxlength: [100, 'اسم القالب يجب أن لا يتجاوز 100 حرف'],
    },
    params: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]): boolean {
          return v.length <= 10;
        },
        message: 'عدد المعاملات يجب أن لا يتجاوز 10',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'] as const,
      default: 'pending',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'سبب الفشل يجب أن لا يتجاوز 1000 حرف'],
    },
    retries: {
      type: Number,
      default: 0,
      min: [0, 'عدد المحاولات لا يمكن أن يكون أقل من 0'],
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: [1, 'الحد الأقصى للمحاولات يجب أن يكون 1 على الأقل'],
      max: [10, 'الحد الأقصى للمحاولات يجب أن لا يتجاوز 10'],
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
whatsAppQueueSchema.index({ status: 1 });
whatsAppQueueSchema.index({ createdAt: -1 });
whatsAppQueueSchema.index({ status: 1, createdAt: 1 }); // For processing pending queue
whatsAppQueueSchema.index({ to: 1 });

// ── Model ───────────────────────────────────────────────────────────
const WhatsAppQueue: Model<IWhatsAppQueue> =
  mongoose.models.WhatsAppQueue ||
  mongoose.model<IWhatsAppQueue>('WhatsAppQueue', whatsAppQueueSchema);

export default WhatsAppQueue;
