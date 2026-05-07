import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export type ReportType =
  | 'revenue'
  | 'services'
  | 'nurses'
  | 'beneficiaries'
  | 'commissions'
  | 'ratings'
  | 'emergencies'
  | 'appointments'
  | 'loyalty'
  | 'coupons';

export type ReportFormat = 'pdf' | 'excel' | 'csv';

export interface IDateRange {
  from: Date;
  to: Date;
}

export interface IReport extends Document {
  type: ReportType;
  generatedBy: Types.ObjectId;
  dateRange: IDateRange;
  data: Record<string, unknown>;
  format: ReportFormat;
  filePath: string;
  createdAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const dateRangeSchema = new Schema<IDateRange>(
  {
    from: {
      type: Date,
      required: true,
    },
    to: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const reportSchema = new Schema<IReport>(
  {
    type: {
      type: String,
      enum: [
        'revenue',
        'services',
        'nurses',
        'beneficiaries',
        'commissions',
        'ratings',
        'emergencies',
        'appointments',
        'loyalty',
        'coupons',
      ] as const,
      required: [true, 'نوع التقرير مطلوب'],
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'مُنشئ التقرير مطلوب'],
    },
    dateRange: {
      type: dateRangeSchema,
      required: [true, 'نطاق التاريخ مطلوب'],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    format: {
      type: String,
      enum: ['pdf', 'excel', 'csv'] as const,
      default: 'pdf',
    },
    filePath: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: false, // Only createdAt
  }
);

// Override toJSON to remove __v
reportSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Add createdAt manually since timestamps is false
reportSchema.add({
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Validation: dateRange.to must be after dateRange.from ───────────
reportSchema.path('dateRange').validate(function (v: IDateRange): boolean {
  if (v && v.from && v.to) {
    return v.to >= v.from;
  }
  return true;
}, 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');

// ── Indexes ─────────────────────────────────────────────────────────
reportSchema.index({ type: 1 });
reportSchema.index({ generatedBy: 1 });
reportSchema.index({ createdAt: -1 });

// ── Model ───────────────────────────────────────────────────────────
const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>('Report', reportSchema);

export default Report;
