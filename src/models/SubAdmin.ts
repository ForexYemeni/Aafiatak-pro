import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export interface ISubAdmin extends Document {
  name: string;
  phone: string;
  passwordHash: string;
  role: 'subadmin';
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const subAdminSchema = new Schema<ISubAdmin>(
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
      enum: ['subadmin'] as const,
      default: 'subadmin',
      immutable: true,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]): boolean {
          const validPermissions = [
            'manage_nurses',
            'manage_beneficiaries',
            'manage_services',
            'manage_requests',
            'manage_emergencies',
            'view_reports',
            'manage_coupons',
            'manage_payments',
            'manage_chats',
            'manage_appointments',
          ];
          return v.every((p) => validPermissions.includes(p));
        },
        message: 'صلاحية غير صالحة',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'] as const,
      default: 'active',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'مُنشئ الحساب مطلوب'],
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
subAdminSchema.index({ phone: 1 }, { unique: true });
subAdminSchema.index({ status: 1 });

// ── Model ───────────────────────────────────────────────────────────
const SubAdmin: Model<ISubAdmin> =
  mongoose.models.SubAdmin || mongoose.model<ISubAdmin>('SubAdmin', subAdminSchema);

export default SubAdmin;
