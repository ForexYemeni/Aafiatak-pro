import mongoose, { Schema, Document, Model } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export interface IAdmin extends Document {
  name: string;
  phone: string;
  passwordHash: string;
  role: 'admin';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true,
      minlength: [2, 'الاسم يجب أن يكون حرفين على الأقل'],
      maxlength: [100, 'الاسم يجب أن لا يتجاوز 100 حرف'],
    },
    phone: {
      type: String,
      required: [true, 'رقم الهاتف مطلوب'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string): boolean {
          return /^7[0-9]{8}$/.test(v);
        },
        message: 'رقم الهاتف يجب أن يبدأ بـ 7 ويتبع بـ 8 أرقام (صيغة يمنية)',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      select: false,
    },
    role: {
      type: String,
      enum: ['admin'] as const,
      default: 'admin',
      immutable: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'] as const,
      default: 'active',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ─────────────────────────────────────────────────────────
adminSchema.index({ phone: 1 }, { unique: true });

// ── Model ───────────────────────────────────────────────────────────
const Admin: Model<IAdmin> =
  mongoose.models.Admin || mongoose.model<IAdmin>('Admin', adminSchema);

export default Admin;
