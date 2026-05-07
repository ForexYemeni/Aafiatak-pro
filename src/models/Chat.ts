import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ── TypeScript Interfaces ───────────────────────────────────────────
export interface IParticipant {
  userId: Types.ObjectId;
  role: 'admin' | 'subadmin' | 'nurse' | 'beneficiary';
  joinedAt: Date;
  leftAt: Date | null;
}

export interface ILastMessage {
  content: string;
  senderId: Types.ObjectId;
  sentAt: Date;
}

export type ChatType = 'direct' | 'group';

export interface IChat extends Document {
  participants: IParticipant[];
  lastMessage: ILastMessage | null;
  relatedRequestId: Types.ObjectId | null;
  type: ChatType;
  isActive: boolean;
  autoDeleteAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────────
const participantSchema = new Schema<IParticipant>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'subadmin', 'nurse', 'beneficiary'] as const,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const lastMessageSchema = new Schema<ILastMessage>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, 'الرسالة يجب أن لا تتجاوز 5000 حرف'],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new Schema<IChat>(
  {
    participants: {
      type: [participantSchema],
      required: [true, 'المشاركون مطلوبون'],
      validate: {
        validator: function (v: IParticipant[]): boolean {
          return v.length >= 2;
        },
        message: 'المحادثة يجب أن تحتوي على مشاركين اثنين على الأقل',
      },
    },
    lastMessage: {
      type: lastMessageSchema,
      default: null,
    },
    relatedRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      default: null,
    },
    type: {
      type: String,
      enum: ['direct', 'group'] as const,
      default: 'direct',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoDeleteAt: {
      type: Date,
      default: null,
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
chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ relatedRequestId: 1 });
chatSchema.index({ isActive: 1 });
chatSchema.index({ autoDeleteAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// ── Model ───────────────────────────────────────────────────────────
const Chat: Model<IChat> =
  mongoose.models.Chat || mongoose.model<IChat>('Chat', chatSchema);

export default Chat;
