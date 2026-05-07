import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IVerificationDocument {
  type: string;
  url: string;
  uploadedAt: Date;
}

export interface IBankAccount {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  iban: string;
}

export interface IGeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface INurse extends Document {
  name: string;
  phone: string;
  passwordHash: string;
  role: 'nurse';
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'rejected';
  specialization: string;
  licenseNumber: string;
  licenseExpiry: Date;
  nationalId: string;
  profileImage: string;
  location: IGeoJSONPoint;
  address: string;
  isVerified: boolean;
  verificationDocuments: IVerificationDocument[];
  availableServices: Types.ObjectId[];
  rating: number;
  totalRatings: number;
  totalEarnings: number;
  availableBalance: number;
  bankAccount: IBankAccount;
  isActive: boolean;
  isOnline: boolean;
  lastLocationUpdate: Date | null;
  deviceToken: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const verificationDocumentSchema = new Schema<IVerificationDocument>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const bankAccountSchema = new Schema<IBankAccount>(
  {
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    iban: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const nurseSchema = new Schema<INurse>(
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
      enum: ['nurse'] as const,
      default: 'nurse',
      immutable: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive', 'suspended', 'rejected'] as const,
      default: 'pending',
    },
    specialization: {
      type: String,
      required: [true, 'التخصص مطلوب'],
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'رقم الترخيص مطلوب'],
      unique: true,
      trim: true,
    },
    licenseExpiry: {
      type: Date,
      required: [true, 'تاريخ انتهاء الترخيص مطلوب'],
    },
    nationalId: {
      type: String,
      required: [true, 'رقم الهوية الوطنية مطلوب'],
      unique: true,
      trim: true,
    },
    profileImage: {
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
    address: {
      type: String,
      default: '',
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationDocuments: {
      type: [verificationDocumentSchema],
      default: [],
    },
    availableServices: {
      type: [Schema.Types.ObjectId],
      ref: 'Service',
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'التقييم لا يمكن أن يكون أقل من 0'],
      max: [5, 'التقييم لا يمكن أن يكون أكثر من 5'],
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: [0, 'عدد التقييمات لا يمكن أن يكون أقل من 0'],
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: [0, 'إجمالي الأرباح لا يمكن أن يكون أقل من 0'],
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: [0, 'الرصيد المتاح لا يمكن أن يكون أقل من 0'],
    },
    bankAccount: {
      type: bankAccountSchema,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastLocationUpdate: {
      type: Date,
      default: null,
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
nurseSchema.index({ phone: 1 }, { unique: true });
nurseSchema.index({ status: 1 });
nurseSchema.index({ isVerified: 1 });
nurseSchema.index({ location: '2dsphere' });
nurseSchema.index({ licenseNumber: 1 }, { unique: true });
nurseSchema.index({ nationalId: 1 }, { unique: true });

// ── Model ───────────────────────────────────────────────────────────
const Nurse: Model<INurse> =
  mongoose.models.Nurse || mongoose.model<INurse>('Nurse', nurseSchema);

export default Nurse;
