// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - TypeScript Types & Interfaces
// ============================================================================
// Comprehensive type definitions for the Arabic RTL healthcare platform
// connecting beneficiaries (patients) with licensed nurses in Yemen.
// ============================================================================

// ============================================================================
// 1. USER TYPES
// ============================================================================

/** User roles within the platform */
export type UserRole = 'admin' | 'subadmin' | 'nurse' | 'beneficiary';

/** User account status */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

/** Nurse verification status */
export type NurseVerificationStatus = 'pending' | 'verified' | 'rejected';

/** Geographic coordinates for nurse location */
export interface NurseLocation {
  lat: number;
  lng: number;
  updatedAt: Date;
}

/** Base user interface with common fields shared across all user roles */
export interface BaseUser {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin user with full platform management privileges */
export interface Admin extends BaseUser {
  role: 'admin';
  email: string;
  lastLoginAt: Date | null;
}

/** Sub-admin with scoped permissions */
export interface SubAdmin extends BaseUser {
  role: 'subadmin';
  email: string;
  permissions: SubAdminPermission[];
  adminId: string;
  lastLoginAt: Date | null;
}

/** Available sub-admin permission scopes */
export type SubAdminPermission =
  | 'manage_nurses'
  | 'manage_beneficiaries'
  | 'manage_orders'
  | 'manage_payments'
  | 'manage_emergencies'
  | 'view_reports'
  | 'manage_services'
  | 'manage_chat'
  | 'manage_settings';

/** Licensed nurse providing home healthcare services */
export interface Nurse extends BaseUser {
  role: 'nurse';
  specialization: NurseSpecialization[];
  licenseNumber: string;
  licenseExpiryDate: Date | null;
  verificationStatus: NurseVerificationStatus;
  isAvailable: boolean;
  isOnline: boolean;
  location: NurseLocation | null;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  cancelledJobs: number;
  totalEarnings: number;
  availableBalance: number;
  availableServices: string[];
  experience: number;
  bio: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  governorate: YemenGovernorate | null;
  bankAccount: string | null;
  walletType: YemeniWallet | null;
  walletNumber: string | null;
  fcmToken: string | null;
  identityDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
  rejectedReason: string | null;
  lastActiveAt: Date | null;
}

/** Nurse specialization areas */
export type NurseSpecialization =
  | 'general_nursing'
  | 'critical_care'
  | 'pediatric'
  | 'elderly_care'
  | 'physiotherapy'
  | 'wound_care'
  | 'iv_therapy'
  | 'mental_health'
  | 'post_surgery'
  | 'emergency';

/** Beneficiary (patient) receiving healthcare services */
export interface Beneficiary extends BaseUser {
  role: 'beneficiary';
  address: string | null;
  city: string | null;
  governorate: YemenGovernorate | null;
  location: NurseLocation | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  dateOfBirth: Date | null;
  gender: 'male' | 'female' | null;
  bloodType: BloodType | null;
  medicalConditions: string[];
  allergies: string[];
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  referralCode: string;
  referredBy: string | null;
  totalSpent: number;
  orderCount: number;
  fcmToken: string | null;
}

/** Blood type for medical records */
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Loyalty tier levels */
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Yemeni governorates */
export type YemenGovernorate =
  | 'sanaa'
  | 'aden'
  | 'taiz'
  | 'hudaydah'
  | 'ibb'
  | 'hadhramaut'
  | 'dhamar'
  | 'marib'
  | 'amran'
  | 'hajjah'
  | 'al_bayda'
  | 'al_mahwit'
  | 'abyan'
  | 'shabwah'
  | 'lahij'
  | 'al_dhale'
  | 'raymah'
  | 'socotra'
  | 'al_mahrah'
  | 'saada'
  | 'al_jawf'
  | 'sanaa_city';

/** Union type for any user in the system */
export type User = Admin | SubAdmin | Nurse | Beneficiary;

/** App-wide user type alias for convenience (same as User union) */
export type AppUser = User;

// ============================================================================
// 2. SERVICE TYPES
// ============================================================================

/** Service category classification */
export type ServiceCategory =
  | 'medical'
  | 'nursing'
  | 'physiotherapy'
  | 'elderly_care'
  | 'pediatric'
  | 'post_surgery'
  | 'lab'
  | 'emergency';

/** Healthcare service offered on the platform */
export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  basePrice: number;
  category: ServiceCategory;
  duration: number; // in minutes
  icon: string;
  image: string | null;
  isActive: boolean;
  isEmergency: boolean;
  requirements: string[];
  includedItems: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Service request status lifecycle */
export type ServiceRequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

/** Pricing breakdown for a service request */
export interface ServicePricing {
  basePrice: number;
  nightFee: number;
  fridayFee: number;
  emergencyFee: number;
  discount: number;
  loyaltyDiscount: number;
  couponDiscount: number;
  totalPrice: number;
  commission: number;
  nursePayout: number;
}

/** Service request created by a beneficiary */
export interface ServiceRequest {
  id: string;
  serviceId: string;
  beneficiaryId: string;
  nurseId: string | null;
  status: ServiceRequestStatus;
  pricing: ServicePricing;
  beneficiaryLocation: NurseLocation;
  beneficiaryAddress: string;
  notes: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  isEmergency: boolean;
  isNightService: boolean;
  isFridayService: boolean;
  ratingId: string | null;
  paymentStatus: TransactionStatus;
  paymentMethod: PaymentType | null;
  couponId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Assignment status for nurse-to-request mapping */
export type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

/** Service assignment tracking a nurse being assigned to a request */
export interface ServiceAssignment {
  id: string;
  requestId: string;
  nurseId: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedByRole: UserRole;
  assignedAt: Date;
  respondedAt: Date | null;
  rejectedReason: string | null;
  estimatedArrivalMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 3. EMERGENCY TYPES
// ============================================================================

/** Emergency classification types */
export type EmergencyType = 'medical' | 'injury' | 'breathing' | 'cardiac' | 'fall' | 'other';

/** Emergency request status */
export type EmergencyStatus = 'pending' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';

/** Emergency request from a beneficiary requiring immediate care */
export interface EmergencyRequest {
  id: string;
  beneficiaryId: string;
  nurseId: string | null;
  type: EmergencyType;
  description: string;
  location: NurseLocation;
  address: string;
  status: EmergencyStatus;
  priority: NotificationPriority;
  responseTime: number | null; // in seconds
  dispatchedAt: Date | null;
  arrivedAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  notes: string | null;
  feedbackRating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Emergency assignment mapping a nurse to an emergency request */
export interface EmergencyAssignment {
  id: string;
  emergencyRequestId: string;
  nurseId: string;
  status: AssignmentStatus;
  distance: number | null; // in km
  estimatedArrivalMinutes: number | null;
  assignedAt: Date;
  respondedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 4. PAYMENT TYPES
// ============================================================================

/** Payment method types available in Yemen */
export type PaymentType =
  | 'cash'
  | 'bank_transfer'
  | 'wallet_deposit'
  | 'exchange_transfer'
  | 'mobile_wallet';

/** Yemeni mobile wallet providers */
export type YemeniWallet = 'one_cash' | 'jawali' | 'yemen_wallet' | 'saba_cash';

/** Transaction status */
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

/** Payment method configuration */
export interface PaymentMethod {
  id: string;
  nameAr: string;
  nameEn: string;
  type: PaymentType;
  icon: string;
  isActive: boolean;
  instructionsAr: string;
  instructionsEn: string;
  sortOrder: number;
}

/** Financial transaction record */
export interface Transaction {
  id: string;
  requestId: string | null;
  emergencyRequestId: string | null;
  beneficiaryId: string;
  nurseId: string | null;
  amount: number;
  commission: number;
  netAmount: number;
  paymentMethod: PaymentType;
  status: TransactionStatus;
  walletType: YemeniWallet | null;
  walletTransactionId: string | null;
  bankReference: string | null;
  exchangeOfficeName: string | null;
  receiptUrl: string | null;
  notes: string | null;
  processedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Nurse payout record */
export interface NursePayout {
  id: string;
  nurseId: string;
  amount: number;
  method: PaymentType;
  status: TransactionStatus;
  transactionIds: string[];
  requestedAt: Date;
  processedAt: Date | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 5. CHAT TYPES
// ============================================================================

/** Chat message types */
export type MessageType = 'text' | 'image' | 'system' | 'quick_reply';

/** Chat participant details */
export interface ChatParticipant {
  userId: string;
  role: UserRole;
  joinedAt: Date;
}

/** Chat conversation between users */
export interface Chat {
  id: string;
  participants: ChatParticipant[];
  requestId: string | null;
  lastMessage: Message | null;
  unreadCount: Record<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Individual chat message */
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  type: MessageType;
  imageUrl: string | null;
  readBy: string[];
  deliveredTo: string[];
  replyTo: string | null;
  quickReplies: QuickReply[] | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Quick reply option for chat messages */
export interface QuickReply {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string;
}

// ============================================================================
// 6. NOTIFICATION TYPES
// ============================================================================

/** Notification classification */
export type NotificationType =
  | 'assignment'
  | 'payment'
  | 'emergency'
  | 'reminder'
  | 'chat'
  | 'status_change'
  | 'appointment'
  | 'rating'
  | 'system';

/** Notification urgency level */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/** In-app notification */
export interface Notification {
  id: string;
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: NotificationType;
  priority: NotificationPriority;
  data: Record<string, string>;
  read: boolean;
  actionUrl: string | null;
  createdAt: Date;
}

/** Push notification sent via FCM */
export interface PushNotification {
  id: string;
  userId: string;
  token: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data: Record<string, string>;
  sent: boolean;
  clicked: boolean;
  sentAt: Date | null;
  clickedAt: Date | null;
  createdAt: Date;
}

/** FCM device token registration */
export interface FCMToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 7. RATING & REVIEW TYPES
// ============================================================================

/** Rating and review for a service request */
export interface Rating {
  id: string;
  requestId: string;
  fromUserId: string;
  toUserId: string;
  fromRole: UserRole;
  toRole: UserRole;
  score: number; // 1-5
  comment: string | null;
  tags: RatingTag[];
  isAnonymous: boolean;
  response: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Rating tags for categorizing feedback */
export type RatingTag =
  | 'punctual'
  | 'professional'
  | 'friendly'
  | 'knowledgeable'
  | 'clean'
  | 'communicative'
  | 'patient'
  | 'thorough'
  | 'late'
  | 'unprofessional'
  | 'unclean'
  | 'uncommunicative';

/** Complaint filed by a user */
export interface Complaint {
  id: string;
  fromUserId: string;
  againstUserId: string;
  requestId: string | null;
  subject: string;
  description: string;
  status: ComplaintStatus;
  priority: NotificationPriority;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Complaint status lifecycle */
export type ComplaintStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

// ============================================================================
// 8. LOYALTY & REFERRAL TYPES
// ============================================================================

/** Loyalty transaction type */
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'bonus';

/** Loyalty points record */
export interface LoyaltyPoints {
  id: string;
  beneficiaryId: string;
  points: number;
  earnedFrom: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

/** Loyalty transaction log */
export interface LoyaltyTransaction {
  id: string;
  beneficiaryId: string;
  points: number;
  type: LoyaltyTransactionType;
  referenceId: string;
  description: string;
  createdAt: Date;
}

/** Referral record tracking user referrals */
export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  code: string;
  reward: number;
  status: ReferralStatus;
  completedAt: Date | null;
  createdAt: Date;
}

/** Referral status */
export type ReferralStatus = 'pending' | 'completed' | 'rewarded' | 'expired';

/** Discount coupon */
export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  expiresAt: Date;
  isActive: boolean;
  createdById: string;
  applicableCategories: ServiceCategory[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 9. APPOINTMENT TYPES
// ============================================================================

/** Appointment status */
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Scheduled appointment between beneficiary and nurse */
export interface Appointment {
  id: string;
  beneficiaryId: string;
  nurseId: string;
  serviceId: string;
  requestId: string | null;
  scheduledAt: Date;
  duration: number; // in minutes
  status: AppointmentStatus;
  notes: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  reminderSentAt: Date | null;
  confirmedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 10. ACTIVITY & LOG TYPES
// ============================================================================

/** Activity log entry for audit trail */
export interface ActivityLog {
  id: string;
  userId: string;
  userRole: UserRole;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, string | number | boolean>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Report type classification */
export type ReportType =
  | 'financial'
  | 'operational'
  | 'nurse_performance'
  | 'beneficiary_activity';

/** Generated report */
export interface Report {
  id: string;
  type: ReportType;
  title: string;
  generatedById: string;
  data: Record<string, string | number | boolean | Record<string, string | number>>;
  format: ReportFormat;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  fileUrl: string | null;
  createdAt: Date;
}

/** Report export format */
export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

// ============================================================================
// 11. SETTINGS TYPES
// ============================================================================

/** Platform-wide admin settings */
export interface AdminSettings {
  id: string;
  commissionRate: number; // percentage
  emergencyFee: number;
  nightFeePercent: number;
  fridayFeePercent: number;
  nightStartHour: number; // 0-23
  nightEndHour: number; // 0-23
  minOrderAmount: number;
  loyaltyPointsPerOrder: number;
  loyaltyRedemptionThreshold: number;
  referralReward: number;
  maxNurseAssignmentRadius: number; // in km
  autoAssignEnabled: boolean;
  emergencyAutoDispatch: boolean;
  maintenanceMode: boolean;
  maintenanceMessageAr: string | null;
  maintenanceMessageEn: string | null;
  supportPhone: string;
  supportWhatsApp: string;
  termsAndConditionsAr: string;
  termsAndConditionsEn: string;
  privacyPolicyAr: string;
  privacyPolicyEn: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 12. API TYPES
// ============================================================================

/** Pagination metadata for list responses */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationMeta;
  statusCode?: number;
}

/** Paginated response with data array */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Authentication response with tokens */
export interface AuthResponse {
  user: BaseUser;
  token: string;
  refreshToken: string;
}

/** Login response type (alias for AuthResponse) */
export type LoginResponse = AuthResponse;

/** Nurse registration response type */
export type RegisterNurseResponse = AuthResponse;

/** Beneficiary registration response type */
export type RegisterBeneficiaryResponse = AuthResponse;

/** Refresh token response */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

/** Login request payload */
export interface LoginRequest {
  phone: string;
  password: string;
  fcmToken?: string;
}

/** Nurse registration request payload */
export interface RegisterNurseRequest {
  name: string;
  phone: string;
  password: string;
  specialization: string;
  licenseNumber: string;
  nationalId?: string;
  city?: string;
  governorate?: YemenGovernorate;
}

/** Beneficiary registration request payload */
export interface RegisterBeneficiaryRequest {
  name: string;
  phone: string;
  password: string;
  address: string;
  city?: string;
  governorate?: YemenGovernorate;
  referralCode?: string;
}

/** OTP verification request */
export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

/** Password reset request */
export interface ResetPasswordRequest {
  phone: string;
  code: string;
  newPassword: string;
}

/** Change password request */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Update profile request */
export interface UpdateProfileRequest {
  name?: string;
  address?: string;
  city?: string;
  governorate?: YemenGovernorate;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  bloodType?: BloodType;
  medicalConditions?: string[];
  allergies?: string[];
}

/** Service request creation payload */
export interface CreateServiceRequestPayload {
  serviceId: string;
  scheduledAt?: Date;
  notes?: string;
  address: string;
  lat: number;
  lng: number;
  isEmergency?: boolean;
  paymentMethod: PaymentType;
  couponCode?: string;
  loyaltyPointsToRedeem?: number;
}

/** Emergency request creation payload */
export interface CreateEmergencyRequestPayload {
  type: EmergencyType;
  description: string;
  address: string;
  lat: number;
  lng: number;
}

/** Filter and sort parameters for list queries */
export interface ListQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================================================
// 13. DASHBOARD TYPES
// ============================================================================

/** Dashboard statistics overview */
export interface DashboardStats {
  totalBeneficiaries: number;
  totalNurses: number;
  totalActiveNurses: number;
  totalPendingNurses: number;
  totalServiceRequests: number;
  totalCompletedRequests: number;
  totalCancelledRequests: number;
  totalEmergencyRequests: number;
  totalRevenue: number;
  totalCommission: number;
  totalNursePayouts: number;
  totalLoyaltyPointsIssued: number;
  totalReferrals: number;
  averageRating: number;
  averageResponseTime: number;
  beneficiaryGrowthRate: number;
  nurseGrowthRate: number;
  revenueGrowthRate: number;
  orderGrowthRate: number;
  pendingVerifications: number;
  activeEmergencies: number;
  todayRevenue: number;
  todayOrders: number;
  todayNewBeneficiaries: number;
  todayNewNurses: number;
}

/** Chart data structure */
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

/** Chart dataset */
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

/** Time range filter for dashboard and reports */
export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'custom';

/** Revenue breakdown by category */
export interface RevenueBreakdown {
  category: ServiceCategory;
  revenue: number;
  orderCount: number;
  percentage: number;
}

/** Nurse performance metrics */
export interface NursePerformanceMetrics {
  nurseId: string;
  nurseName: string;
  completedJobs: number;
  cancelledJobs: number;
  averageRating: number;
  totalEarnings: number;
  averageResponseTime: number;
  acceptanceRate: number;
}

// ============================================================================
// 14. MAP TYPES
// ============================================================================

/** Map marker for displaying locations on a map */
export interface MapMarker {
  id: string;
  position: [number, number];
  type: 'nurse' | 'beneficiary' | 'emergency';
  label: string;
  status: string;
  metadata?: Record<string, string | number | boolean>;
}

/** Real-time nurse tracking data */
export interface TrackingData {
  nurseId: string;
  location: NurseLocation;
  heading: number;
  speed: number;
  isOnline: boolean;
  batteryLevel: number | null;
  currentRequestId: string | null;
}

/** Route point for path tracking */
export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: Date;
}

/** Route data for nurse travel path */
export interface RouteData {
  nurseId: string;
  requestId: string;
  points: RoutePoint[];
  totalDistance: number; // in km
  totalDuration: number; // in seconds
}

// ============================================================================
// 15. SOCKET EVENT TYPES
// ============================================================================

/** Socket event payload types for real-time communication */
export interface SocketEvents {
  // Chat events
  new_message: {
    message: Message;
    chatId: string;
  };
  typing: {
    chatId: string;
    userId: string;
    isTyping: boolean;
  };
  read_receipt: {
    chatId: string;
    messageIds: string[];
    readBy: string;
  };
  message_delivered: {
    chatId: string;
    messageIds: string[];
    deliveredTo: string;
  };

  // Location events
  location_update: {
    nurseId: string;
    location: NurseLocation;
    heading: number;
    speed: number;
  };

  // Order events
  order_update: {
    requestId: string;
    status: ServiceRequestStatus;
    nurseId: string | null;
    updatedAt: Date;
  };

  // Emergency events
  emergency_alert: {
    emergencyRequestId: string;
    type: EmergencyType;
    location: NurseLocation;
    beneficiaryId: string;
    description: string;
  };
  emergency_update: {
    emergencyRequestId: string;
    status: EmergencyStatus;
    nurseId: string | null;
    updatedAt: Date;
  };

  // Assignment events
  assignment_created: {
    assignmentId: string;
    requestId: string;
    nurseId: string;
  };
  assignment_responded: {
    assignmentId: string;
    requestId: string;
    nurseId: string;
    status: AssignmentStatus;
  };

  // Notification events
  notification: {
    notification: Notification;
    userId: string;
  };

  // User presence events
  user_online: {
    userId: string;
    role: UserRole;
  };
  user_offline: {
    userId: string;
    role: UserRole;
    lastSeen: Date;
  };

  // Nurse availability events
  nurse_availability_changed: {
    nurseId: string;
    isAvailable: boolean;
  };
}

/** Socket event names extracted from SocketEvents */
export type SocketEventName = keyof SocketEvents;

// ============================================================================
// 16. WHATSAPP QUEUE TYPES
// ============================================================================

/** WhatsApp message delivery status */
export type WhatsAppStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

/** WhatsApp template message in the queue */
export interface WhatsAppMessage {
  id: string;
  to: string;
  template: WhatsAppTemplate;
  params: Record<string, string>;
  status: WhatsAppStatus;
  attempts: number;
  maxAttempts: number;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** WhatsApp message templates */
export type WhatsAppTemplate =
  | 'otp_verification'
  | 'order_confirmation'
  | 'order_assigned'
  | 'order_in_progress'
  | 'order_completed'
  | 'emergency_dispatch'
  | 'appointment_reminder'
  | 'payment_confirmation'
  | 'nurse_verification_approved'
  | 'nurse_verification_rejected'
  | 'welcome_beneficiary'
  | 'welcome_nurse'
  | 'loyalty_points_earned'
  | 'referral_reward'
  | 'rating_request'
  | 'order_cancelled';

// ============================================================================
// UTILITY / HELPER TYPES
// ============================================================================

/** Make specific keys required on a type */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys optional on a type */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep partial type for update operations */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Nullable type helper */
export type Nullable<T> = T | null;

/** Dictionary type helper */
export type Dictionary<T> = Record<string, T>;

/** Value of type helper - extracts the value type from an object */
export type ValueOf<T> = T[keyof T];

/** Async function result type */
export type AsyncResult<T, E = string> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;

// ============================================================================
// 17. AUTH / TOKEN TYPES (used by middleware and API routes)
// ============================================================================

/** JWT token payload */
export interface TokenPayload {
  userId: string;
  phone: string;
  role: UserRole;
}

/** Authenticated request with decoded user payload */
export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

/** Generic app user returned from auth (serialized for JSON) */
export interface AppUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Admin user response */
export interface AdminUser extends AppUser {
  role: 'admin';
  email?: string;
  lastLoginAt?: string | null;
}

/** Sub-admin user response */
export interface SubAdminUser extends AppUser {
  role: 'subadmin';
  email?: string;
  permissions?: SubAdminPermission[];
  adminId?: string | null;
  lastLoginAt?: string | null;
}

/** Nurse user response */
export interface NurseUser extends AppUser {
  role: 'nurse';
  specialty?: string | null;
  licenseNo?: string | null;
  hospital?: string | null;
  governorate?: string | null;
  district?: string | null;
  verificationStatus?: NurseVerificationStatus;
  isAvailable?: boolean;
  rating?: number;
  completedJobs?: number;
}

/** Beneficiary user response */
export interface BeneficiaryUser extends AppUser {
  role: 'beneficiary';
  referralCode: string;
  governorate?: string | null;
  district?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
}

/** Login response payload */
export interface LoginResponse {
  user: AppUser;
  token: string;
  refreshToken: string;
}

/** Me endpoint response */
export interface MeResponse {
  user: AppUser;
}

/** Register response payload */
export interface RegisterNurseResponse {
  user: NurseUser;
  token: string;
  refreshToken: string;
}

/** Register beneficiary response payload */
export interface RegisterBeneficiaryResponse {
  user: BeneficiaryUser;
  token: string;
  refreshToken: string;
}

/** Refresh token response */
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

/** Yemen governorates list */
export const YEMEN_GOVERNORATES: readonly string[] = [
  'sanaa', 'aden', 'taiz', 'hudaydah', 'ibb', 'hadhramaut',
  'dhamar', 'marib', 'amran', 'hajjah', 'al_bayda', 'al_mahwit',
  'abyan', 'shabwah', 'lahij', 'al_dhale', 'raymah', 'socotra',
  'al_mahrah', 'saada', 'al_jawf', 'sanaa_city',
] as const;

/** Gender type */
export type Gender = 'male' | 'female';
