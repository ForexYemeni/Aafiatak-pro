import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export interface IService extends Document {
  nameAr: string;
  nameEn: string;
  description: string;
  basePrice: number;
  category: string;
  duration: number; // in minutes
  icon: string;
  isActive: boolean;
  requiresVerification: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const serviceSchema = new Schema<IService>(
  {
    nameAr: {
      type: String,
      required: [true, 'اسم الخدمة بالعربية مطلوب'],
      trim: true,
      minlength: [2, 'اسم الخدمة يجب أن يكون حرفين على الأقل'],
      maxlength: [200, 'اسم الخدمة يجب أن لا يتجاوز 200 حرف'],
    },
    nameEn: {
      type: String,
      required: [true, 'اسم الخدمة بالإنجليزية مطلوب'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [200, 'Service name must not exceed 200 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'الوصف يجب أن لا يتجاوز 1000 حرف'],
    },
    basePrice: {
      type: Number,
      required: [true, 'السعر الأساسي مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون أقل من 0'],
    },
    category: {
      type: String,
      required: [true, 'التصنيف مطلوب'],
      trim: true,
      enum: [
        'nursing',
        'physiotherapy',
        'elderly_care',
        'child_care',
        'wound_care',
        'injection',
        'lab_sample',
        'chronic_disease',
        'post_surgery',
        'emergency',
      ],
    },
    duration: {
      type: Number,
      required: [true, 'مدة الخدمة مطلوبة'],
      min: [5, 'المدة يجب أن تكون 5 دقائق على الأقل'],
      max: [480, 'المدة يجب أن لا تتجاوز 8 ساعات'],
    },
    icon: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    requiresVerification: {
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
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ nameAr: 'text', nameEn: 'text' });

// ── Model ───────────────────────────────────────────────────────────
const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>('Service', serviceSchema);

export default Service;
