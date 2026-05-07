import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IReferralRewardConfig {
  referrerPoints: number;
  referredPoints: number;
}

export interface IAdminSettings extends Document {
  commissionRate: number;
  emergencyFee: number;
  nightFeePercent: number;
  fridayFeePercent: number;
  nightStartHour: number;
  nightEndHour: number;
  minOrderAmount: number;
  loyaltyPointsPerOrder: number;
  loyaltyRedemptionThreshold: number;
  referralReward: IReferralRewardConfig;
  maintenanceMode: boolean;
  supportPhone: string;
  supportEmail: string;
  whatsappNumber: string;
  appVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const referralRewardConfigSchema = new Schema<IReferralRewardConfig>(
  {
    referrerPoints: {
      type: Number,
      default: 50,
      min: [0, 'نقاط المُحيل لا يمكن أن تكون أقل من 0'],
    },
    referredPoints: {
      type: Number,
      default: 50,
      min: [0, 'نقاط المُحال لا يمكن أن تكون أقل من 0'],
    },
  },
  { _id: false }
);

const adminSettingsSchema = new Schema<IAdminSettings>(
  {
    commissionRate: {
      type: Number,
      default: 15,
      min: [0, 'نسبة العمولة لا يمكن أن تكون أقل من 0'],
      max: [100, 'نسبة العمولة لا يمكن أن تتجاوز 100'],
    },
    emergencyFee: {
      type: Number,
      default: 0,
      min: [0, 'رسوم الطوارئ لا يمكن أن تكون أقل من 0'],
    },
    nightFeePercent: {
      type: Number,
      default: 50,
      min: [0, 'رسوم الليل لا يمكن أن تكون أقل من 0%'],
      max: [200, 'رسوم الليل لا يمكن أن تتجاوز 200%'],
    },
    fridayFeePercent: {
      type: Number,
      default: 25,
      min: [0, 'رسوم الجمعة لا يمكن أن تكون أقل من 0%'],
      max: [200, 'رسوم الجمعة لا يمكن أن تتجاوز 200%'],
    },
    nightStartHour: {
      type: Number,
      default: 22,
      min: [0, 'ساعة بداية الليل يجب أن تكون بين 0 و 23'],
      max: [23, 'ساعة بداية الليل يجب أن تكون بين 0 و 23'],
    },
    nightEndHour: {
      type: Number,
      default: 6,
      min: [0, 'ساعة نهاية الليل يجب أن تكون بين 0 و 23'],
      max: [23, 'ساعة نهاية الليل يجب أن تكون بين 0 و 23'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'الحد الأدنى للطلب لا يمكن أن يكون أقل من 0'],
    },
    loyaltyPointsPerOrder: {
      type: Number,
      default: 10,
      min: [0, 'نقاط الولاء لكل طلب لا يمكن أن تكون أقل من 0'],
    },
    loyaltyRedemptionThreshold: {
      type: Number,
      default: 100,
      min: [0, 'حد استبدال نقاط الولاء لا يمكن أن يكون أقل من 0'],
    },
    referralReward: {
      type: referralRewardConfigSchema,
      default: () => ({ referrerPoints: 50, referredPoints: 50 }),
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    supportPhone: {
      type: String,
      default: '',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (v: string): boolean {
          if (!v) return true; // Allow empty
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'البريد الإلكتروني غير صالح',
      },
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
    },
    appVersion: {
      type: String,
      default: '1.0.0',
      trim: true,
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

// ── Singleton Pattern ───────────────────────────────────────────────
// Ensure only one document exists for AdminSettings
adminSettingsSchema.statics.getSettings = async function (): Promise<IAdminSettings> {
  const settings = await this.findOne();
  if (!settings) {
    return this.create({});
  }
  return settings;
};

// ── Indexes ─────────────────────────────────────────────────────────
// Singleton: no special indexes needed, but add a compound index to enforce single doc
adminSettingsSchema.index(
  { createdAt: 1 },
  { unique: true, partialFilterExpression: { createdAt: { $exists: true } } }
);

// ── Model ───────────────────────────────────────────────────────────
interface AdminSettingsModel extends Model<IAdminSettings> {
  getSettings(): Promise<IAdminSettings>;
}

const AdminSettings: AdminSettingsModel =
  mongoose.models.AdminSettings ||
  mongoose.model<IAdminSettings, AdminSettingsModel>('AdminSettings', adminSettingsSchema);

export default AdminSettings;
