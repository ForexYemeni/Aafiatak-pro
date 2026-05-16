import mongoose, { Schema, Document, Types } from 'mongoose';

export type ComplaintStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IComplaint extends Document {
  fromUserId: Types.ObjectId;
  fromUserName: string;
  fromUserRole: string;
  againstUserId?: Types.ObjectId;
  againstUserName?: string;
  subject: string;
  description: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  category: string;
  resolution?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  adminNotes?: string;
  requestId?: Types.ObjectId;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    fromUserName: {
      type: String,
      required: true,
      trim: true,
    },
    fromUserRole: {
      type: String,
      required: true,
      enum: ['beneficiary', 'nurse'],
    },
    againstUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    againstUserName: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'الموضوع يجب أن يكون 3 أحرف على الأقل'],
      maxlength: [200, 'الموضوع يجب أن لا يتجاوز 200 حرف'],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, 'الوصف يجب أن يكون 10 أحرف على الأقل'],
      maxlength: [2000, 'الوصف يجب أن لا يتجاوز 2000 حرف'],
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'] as ComplaintStatus[],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'] as ComplaintPriority[],
      default: 'medium',
    },
    category: {
      type: String,
      default: 'general',
      enum: ['general', 'service', 'nurse', 'payment', 'technical', 'other'],
    },
    resolution: {
      type: String,
      trim: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    requestId: {
      type: Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
ComplaintSchema.index({ fromUserId: 1, createdAt: -1 });
ComplaintSchema.index({ status: 1, createdAt: -1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ category: 1 });

export const Complaint = mongoose.models.Complaint || mongoose.model<IComplaint>('Complaint', ComplaintSchema);
