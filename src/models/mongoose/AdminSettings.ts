import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminSettings extends Document {
  commissionRate: number;
  emergencyFee: number;
  nightFeePercent: number;
  fridayFeePercent: number;
  nightStartHour: number;
  nightEndHour: number;
  minOrderAmount: number;
  loyaltyPointsPerOrder: number;
  referralReward: number;
  maxNurseAssignmentRadius: number;
  autoAssignEnabled: boolean;
  emergencyAutoDispatch: boolean;
  maintenanceMode: boolean;
  maintenanceMessageAr?: string;
  supportPhone: string;
  supportWhatsApp: string;
  supportPhones: string[];
  supportWhatsAppNumbers: string[];
  termsAndConditionsAr: string;
  privacyPolicyAr: string;
  loyaltyRedemptionThreshold: number;
  supportEmail: string;
}

const AdminSettingsSchema = new Schema<IAdminSettings>({
  commissionRate: { type: Number, default: 15 },
  emergencyFee: { type: Number, default: 5000 },
  nightFeePercent: { type: Number, default: 20 },
  fridayFeePercent: { type: Number, default: 15 },
  nightStartHour: { type: Number, default: 22 },
  nightEndHour: { type: Number, default: 6 },
  minOrderAmount: { type: Number, default: 2000 },
  loyaltyPointsPerOrder: { type: Number, default: 10 },
  referralReward: { type: Number, default: 50 },
  maxNurseAssignmentRadius: { type: Number, default: 20 },
  autoAssignEnabled: { type: Boolean, default: false },
  emergencyAutoDispatch: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessageAr: { type: String },
  supportPhone: { type: String, default: '+967123456789' },
  supportWhatsApp: { type: String, default: '+967123456789' },
  supportPhones: [{ type: String }],
  supportWhatsAppNumbers: [{ type: String }],
  termsAndConditionsAr: { type: String, default: '' },
  privacyPolicyAr: { type: String, default: '' },
  loyaltyRedemptionThreshold: { type: Number, default: 100 },
  supportEmail: { type: String, default: '' },
}, { timestamps: true });

export const AdminSettings = mongoose.models.AdminSettings || mongoose.model<IAdminSettings>('AdminSettings', AdminSettingsSchema);
