import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================================================
// عافيتك - نموذج طلب الخدمة الخاصة
// ============================================================================
// هذا النموذج يتعامل مع الطلبات الخاصة التي يطلبها المستفيد والتي تتطلب
// تفاوضاً مع الإدارة حول السعر والمدة قبل التنفيذ.
// ============================================================================

// ── أنواع الرسائل في المحادثة ────────────────────────────────────────────
export type SpecialServiceMessageType = 'text' | 'image' | 'file' | 'system' | 'offer' | 'payment_proof' | 'payment_decision' | 'rejection_reason';

export interface ISpecialServiceMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'beneficiary' | 'admin' | 'subadmin' | 'nurse' | 'system';
  type: SpecialServiceMessageType;
  content: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  // بيانات عرض السعر (إذا كانت الرسالة من نوع offer)
  offerData?: {
    price: number;
    duration: string;
    notes?: string;
    status?: 'pending' | 'accepted' | 'rejected' | 'expired';
    offerIndex: number;
  };
  readBy: Types.ObjectId[];
  createdAt: Date;
}

// ─ـ سجل عروض الأسعار ────────────────────────────────────────────────────
export interface IOfferRecord {
  _id?: Types.ObjectId;
  offerIndex: number;
  price: number;
  duration: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  sentBy: Types.ObjectId;
  sentByRole: 'admin' | 'subadmin';
  sentAt: Date;
  respondedAt?: Date;
}

// ── حالات الطلب ──────────────────────────────────────────────────────────
export type SpecialServiceStatus =
  | 'new'                    // جديد - تم إنشاؤه للتو
  | 'negotiating'            // جاري التفاوض
  | 'awaiting_payment'       // بانتظار الدفع
  | 'awaiting_payment_review'// بانتظار مراجعة الدفع
  | 'paid'                   // تم الدفع
  | 'awaiting_nurse'         // بانتظار تعيين ممرض
  | 'in_progress'            // جار التنفيذ
  | 'completed'              // مكتمل
  | 'rejected'               // مرفوض
  | 'cancelled';             // ملغي

// ── الواجهة الرئيسية ────────────────────────────────────────────────────
export interface ISpecialServiceRequest extends Document {
  // رقم الطلب - يبدأ من 1000
  orderNumber: number;

  // المستفيد
  beneficiaryId: Types.ObjectId;
  beneficiaryName: string;
  beneficiaryPhone: string;

  // بيانات الطلب
  serviceName: string;           // اسم الخدمة الرئيسية (مثال: ممرض خاص)
  requestedServices: string[];   // الخدمات المطلوبة (كل خدمة في سطر مستقل)
  notes?: string;                // ملاحظات إضافية

  // الموقع
  address: string;
  lat: number;
  lng: number;

  // الموعد
  scheduledDate?: Date;
  scheduledTime?: string;

  // الحالة
  status: SpecialServiceStatus;

  // عروض الأسعار
  offers: IOfferRecord[];
  currentOfferId?: Types.ObjectId;

  // المبلغ المتفق عليه
  agreedPrice?: number;
  agreedDuration?: string;
  adminNotes?: string;

  // الدفع - نستخدم نفس نظام الدفع الموجود
  paymentMethod?: string;
  paymentMethodId?: string;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  paymentStatus?: 'pending' | 'awaiting_confirmation' | 'completed' | 'failed' | 'refunded';
  paymentVerifiedAt?: Date;
  paymentRejectionReason?: string;

  // الممرض
  nurseId?: Types.ObjectId;
  nurseAssignedAt?: Date;
  nurseAcceptedAt?: Date;
  nurseRejectedAt?: Date;

  // التسعير النهائي (يحسب من النظام الحالي)
  commissionRate?: number;
  commission?: number;
  nursePayout?: number;

  // التنفيذ
  startedAt?: Date;
  completedAt?: Date;
  beneficiaryConfirmedAt?: Date;
  executeByAdmin?: boolean;

  // التقييم
  serviceRating?: number;
  nurseRating?: number;
  ratingComment?: string;
  ratedAt?: Date;

  // الإلغاء
  cancelledAt?: Date;
  cancelReason?: string;
  rejectedAt?: Date;
  rejectionReason?: string;

  // المحادثة
  messages: ISpecialServiceMessage[];
  lastMessageAt?: Date;
  lastMessageContent?: string;
  lastMessageSender?: string;

  // أرشيف المستخدمين الذين قرؤوا آخر رسالة
  unreadCount: Map<string, number>;

  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-Schemas ──────────────────────────────────────────────────────────

const offerRecordSchema = new Schema<IOfferRecord>({
  offerIndex: { type: Number, required: true },
  price: { type: Number, required: true },
  duration: { type: String, required: true },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
  sentBy: { type: Schema.Types.ObjectId, required: true },
  sentByRole: { type: String, enum: ['admin', 'subadmin'], required: true },
  sentAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
}, { _id: true, timestamps: false });

const messageSchema = new Schema<ISpecialServiceMessage>({
  senderId: { type: Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ['beneficiary', 'admin', 'subadmin', 'nurse', 'system'], required: true },
  type: { type: String, enum: ['text', 'image', 'file', 'system', 'offer', 'payment_proof', 'payment_decision', 'rejection_reason'], default: 'text' },
  content: { type: String, required: true, default: '' },
  imageUrl: { type: String },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  offerData: {
    price: { type: Number },
    duration: { type: String },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
    offerIndex: { type: Number },
  },
  readBy: [{ type: Schema.Types.ObjectId }],
}, { _id: true, timestamps: { createdAt: true, updatedAt: false } });

// ── Main Schema ──────────────────────────────────────────────────────────

const SpecialServiceRequestSchema = new Schema<ISpecialServiceRequest>({
  orderNumber: { type: Number, unique: true, index: true },
  beneficiaryId: { type: Schema.Types.ObjectId, ref: 'Beneficiary', required: true, index: true },
  beneficiaryName: { type: String, required: true },
  beneficiaryPhone: { type: String, required: true },

  serviceName: { type: String, required: true, trim: true },
  requestedServices: { type: [String], default: [], validate: [(v: string[]) => v.length > 0, 'يجب تحديد خدمة واحدة على الأقل'] },
  notes: { type: String, trim: true },

  address: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  scheduledDate: { type: Date },
  scheduledTime: { type: String },

  status: {
    type: String,
    enum: ['new', 'negotiating', 'awaiting_payment', 'awaiting_payment_review', 'paid', 'awaiting_nurse', 'in_progress', 'completed', 'rejected', 'cancelled'],
    default: 'new',
    index: true,
  },

  offers: { type: [offerRecordSchema], default: [] },
  currentOfferId: { type: Schema.Types.ObjectId },

  agreedPrice: { type: Number },
  agreedDuration: { type: String },
  adminNotes: { type: String },

  paymentMethod: { type: String },
  paymentMethodId: { type: String },
  hasPaymentProof: { type: Boolean, default: false },
  paymentProofData: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'awaiting_confirmation', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentVerifiedAt: { type: Date },
  paymentRejectionReason: { type: String },

  nurseId: { type: Schema.Types.ObjectId, ref: 'Nurse' },
  nurseAssignedAt: { type: Date },
  nurseAcceptedAt: { type: Date },
  nurseRejectedAt: { type: Date },

  commissionRate: { type: Number },
  commission: { type: Number },
  nursePayout: { type: Number },

  startedAt: { type: Date },
  completedAt: { type: Date },
  beneficiaryConfirmedAt: { type: Date },
  executeByAdmin: { type: Boolean, default: false },

  serviceRating: { type: Number, min: 1, max: 5 },
  nurseRating: { type: Number, min: 1, max: 5 },
  ratingComment: { type: String },
  ratedAt: { type: Date },

  cancelledAt: { type: Date },
  cancelReason: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },

  messages: { type: [messageSchema], default: [] },
  lastMessageAt: { type: Date },
  lastMessageContent: { type: String },
  lastMessageSender: { type: String },

  unreadCount: { type: Map, of: Number, default: {} },
}, { timestamps: true });

// ── Indexes for performance ─────────────────────────────────────────────
SpecialServiceRequestSchema.index({ beneficiaryId: 1, status: 1, createdAt: -1 });
SpecialServiceRequestSchema.index({ nurseId: 1, status: 1, createdAt: -1 });
SpecialServiceRequestSchema.index({ status: 1, createdAt: -1 });
SpecialServiceRequestSchema.index({ lastMessageAt: -1 });

// ── Pre-save hook: auto-generate orderNumber ────────────────────────────
SpecialServiceRequestSchema.pre('validate', async function (this: ISpecialServiceRequest, next) {
  if (!this.orderNumber) {
    try {
      const lastRequest = await (this.constructor as any).findOne({}, { orderNumber: 1 }).sort({ orderNumber: -1 }).lean();
      this.orderNumber = (lastRequest?.orderNumber ?? 1000) + 1;
    } catch {
      this.orderNumber = Math.floor(1000 + Math.random() * 9000);
    }
  }
  next();
});

// ── Model ────────────────────────────────────────────────────────────────
export const SpecialServiceRequest =
  (mongoose.models.SpecialServiceRequest as mongoose.Model<ISpecialServiceRequest>) ||
  mongoose.model<ISpecialServiceRequest>('SpecialServiceRequest', SpecialServiceRequestSchema);

export default SpecialServiceRequest;
