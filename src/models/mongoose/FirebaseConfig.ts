// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Config Model
// ============================================================================
// Stores Firebase Admin SDK credentials so the admin can configure
// Firebase from the dashboard instead of relying solely on env vars.
// ============================================================================

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFirebaseConfig extends Document {
  projectId: string;
  clientEmail: string;
  privateKey: string; // encrypted in transit, stored as-is
  storageBucket?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const firebaseConfigSchema = new Schema<IFirebaseConfig>(
  {
    projectId: { type: String, required: true, trim: true },
    clientEmail: { type: String, required: true, trim: true },
    privateKey: { type: String, required: true }, // Store as-is (already encrypted in transit)
    storageBucket: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'firebaseconfigs' }
);

// Only keep one active config
firebaseConfigSchema.index({ isActive: 1 });

const FirebaseConfig: Model<IFirebaseConfig> =
  mongoose.models.FirebaseConfig || mongoose.model<IFirebaseConfig>('FirebaseConfig', firebaseConfigSchema);

export default FirebaseConfig;
