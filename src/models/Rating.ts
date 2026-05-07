import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interface ────────────────────────────────────────────
export type RatingFromRole = 'beneficiary' | 'nurse' | 'admin';
export type RatingToRole = 'nurse' | 'beneficiary';

export interface IRating extends Document {
  requestId: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  fromRole: RatingFromRole;
  toRole: RatingToRole;
  score: number;
  comment: string;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const ratingSchema = new Schema<IRating>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      required: [true, 'طلب الخدمة مطلوب'],
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      required: [true, 'المُقيّم مطلوب'],
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      required: [true, 'المُقيَّم مطلوب'],
    },
    fromRole: {
      type: String,
      enum: ['beneficiary', 'nurse', 'admin'] as const,
      required: [true, 'دور المُقيّم مطلوب'],
    },
    toRole: {
      type: String,
      enum: ['nurse', 'beneficiary'] as const,
      required: [true, 'دور المُقيَّم مطلوب'],
    },
    score: {
      type: Number,
      required: [true, 'التقييم مطلوب'],
      min: [1, 'التقييم يجب أن يكون 1 على الأقل'],
      max: [5, 'التقييم يجب أن لا يتجاوز 5'],
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'التعليق يجب أن لا يتجاوز 1000 حرف'],
    },
    isAnonymous: {
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
ratingSchema.index({ toUserId: 1 });
ratingSchema.index({ requestId: 1 });
ratingSchema.index({ requestId: 1, fromUserId: 1 }, { unique: true }); // One rating per request per user
ratingSchema.index({ fromUserId: 1 });
ratingSchema.index({ toUserId: 1, createdAt: -1 });

// ── Model ───────────────────────────────────────────────────────────
const Rating: Model<IRating> =
  mongoose.models.Rating || mongoose.model<IRating>('Rating', ratingSchema);

export default Rating;
