import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  basePrice: number;
  category: string;
  duration: number;
  icon: string;
  image?: string;
  isActive: boolean;
  isEmergency: boolean;
  requirements: string[];
  includedItems: string[];
  sortOrder: number;
}

const ServiceSchema = new Schema<IService>({
  nameAr: { type: String, required: true },
  nameEn: { type: String, required: true },
  descriptionAr: { type: String },
  descriptionEn: { type: String },
  basePrice: { type: Number, required: true },
  category: { type: String, default: 'nursing' },
  duration: { type: Number, default: 60 },
  icon: { type: String, default: '' },
  image: { type: String },
  isActive: { type: Boolean, default: true },
  isEmergency: { type: Boolean, default: false },
  requirements: [{ type: String }],
  includedItems: [{ type: String }],
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const Service = mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema);
