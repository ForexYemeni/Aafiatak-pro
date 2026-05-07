import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: string;
  content: string;
  type: 'text' | 'image' | 'system';
  imageUrl?: string;
  readBy: Types.ObjectId[];
  isDeleted: boolean;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId: { type: Schema.Types.ObjectId, required: true },
  senderRole: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
  imageUrl: { type: String },
  readBy: [{ type: Schema.Types.ObjectId }],
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

ChatMessageSchema.index({ chatId: 1 });

export const ChatMessage = mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
