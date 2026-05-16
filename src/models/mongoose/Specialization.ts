import mongoose, { Schema, Document } from 'mongoose';

export interface ISpecialization extends Document {
  id: string;
  label: string;
  category: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SpecializationSchema = new Schema<ISpecialization>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SpecializationSchema.index({ id: 1 }, { unique: true });
SpecializationSchema.index({ category: 1 });
SpecializationSchema.index({ isActive: 1, order: 1 });

export const Specialization =
  mongoose.models.Specialization ||
  mongoose.model<ISpecialization>('Specialization', SpecializationSchema);
