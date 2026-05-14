import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChat extends Document {
  participants: { userId: Types.ObjectId; role: string; joinedAt: Date }[];
  requestId?: Types.ObjectId;
  lastMessageContent?: string;
  lastMessageSender?: string;
  lastMessageAt?: Date;
  unreadCount: Map<string, number>;
  isActive: boolean;
}

const ChatSchema = new Schema<IChat>({
  participants: [{
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  }],
  requestId: { type: Schema.Types.ObjectId },
  lastMessageContent: { type: String },
  lastMessageSender: { type: String },
  lastMessageAt: { type: Date },
  unreadCount: { type: Map, of: Number, default: {} },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ── Performance Indexes ──────────────────────────────────────────────
  ChatSchema.index({ 'participants.userId': 1 });
  ChatSchema.index({ isActive: 1, lastMessageAt: -1 });

  export const Chat = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);
