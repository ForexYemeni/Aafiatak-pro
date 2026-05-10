import mongoose, { Schema, Document, Types } from 'mongoose';

export type RatingType = 'service' | 'emergency' | 'deployment';

export interface IRating extends Document {
  requestId: Types.ObjectId;
  ratingType: RatingType;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  fromRole: string;
  toRole: string;
  score: number;
  comment?: string;
  tags: string[];
  isAnonymous: boolean;
  response?: string;
}

const RatingSchema = new Schema<IRating>({
  requestId: { type: Schema.Types.ObjectId, required: true, unique: true },
  ratingType: { type: String, enum: ['service', 'emergency', 'deployment'], default: 'service' },
  fromUserId: { type: Schema.Types.ObjectId, required: true },
  toUserId: { type: Schema.Types.ObjectId, required: true },
  fromRole: { type: String, required: true },
  toRole: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  tags: [{ type: String }],
  isAnonymous: { type: Boolean, default: false },
  response: { type: String },
}, { timestamps: true });

// Add index for faster queries by ratingType
RatingSchema.index({ ratingType: 1, createdAt: -1 });

export const Rating = mongoose.models.Rating || mongoose.model<IRating>('Rating', RatingSchema);
