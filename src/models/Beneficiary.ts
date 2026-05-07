import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IEmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface IGeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IBeneficiary extends Document {
  name: string;
  phone: string;
  passwordHash: string;
  role: 'beneficiary';
  status: 'active' | 'inactive' | 'suspended';
  address: string;
  location: IGeoJSONPoint;
  emergencyContact: IEmergencyContact;
  dateOfBirth: Date | null;
  gender: 'male' | 'female';
  bloodType: string;
  medicalNotes: string;
  profileImage: string;
  loyaltyPoints: number;
  referralCode: string;
  referredBy: Types.ObjectId | null;
  favoriteNurses: Types.ObjectId[];
  deviceToken: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string): boolean {
          return /^7[0-9]{8}$/.test(v);
        },
        message: 'رقم الهاتف يجب أن يبدأ بـ 7 ويتبع بـ 8 أرقام (صيغة يمنية)',
      },
    },
    relation: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const beneficiarySchema = new Schema<IBeneficiary>(
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
      enum: ['beneficiary'] as const,
      default: 'beneficiary',
      immutable: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'] as const,
      default: 'active',
    },
    address: {
      type: String,
      default: '',
      trim: true,
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
    emergencyContact: {
      type: emergencyContactSchema,
      required: false,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female'] as const,
      required: [true, 'الجنس مطلوب'],
    },
    bloodType: {
      type: String,
      default: '',
      enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    medicalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
      trim: true,
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: [0, 'نقاط الولاء لا يمكن أن تكون أقل من 0'],
    },
    referralCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'Beneficiary',
      default: null,
    },
    favoriteNurses: {
      type: [Schema.Types.ObjectId],
      ref: 'Nurse',
      default: [],
    },
    deviceToken: {
      type: String,
      default: '',
      trim: true,
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
beneficiarySchema.index({ phone: 1 }, { unique: true });
beneficiarySchema.index({ referralCode: 1 }, { unique: true, sparse: true });
beneficiarySchema.index({ status: 1 });
beneficiarySchema.index({ location: '2dsphere' });

// ── Model ───────────────────────────────────────────────────────────
const Beneficiary: Model<IBeneficiary> =
  mongoose.models.Beneficiary || mongoose.model<IBeneficiary>('Beneficiary', beneficiarySchema);

export default Beneficiary;
