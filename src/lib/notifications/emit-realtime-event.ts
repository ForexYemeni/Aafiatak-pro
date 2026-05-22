// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Unified Real-time Event Emitter
// ============================================================================
// A single entry point for all API routes to emit Socket.IO real-time events.
// This ensures that every data mutation triggers instant UI updates for ALL
// connected users without relying on polling.
//
// USAGE in API routes:
//   import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';
//   emitRealtimeEvent.orderCreated(orderData, { changedBy: userId, changedByRole: 'admin' });
//   emitRealtimeEvent.paymentUpdated(deploymentId, applicationId, applicantId, status, action, { changedBy, changedByRole });
// ============================================================================

import {
  emitToAdmins,
  emitToUser,
  emitToRole,
  emitNotificationToUsers,
} from './socket-client';

// ============================================================================
// TYPES
// ============================================================================

interface ChangeMeta {
  changedBy: string;
  changedByRole: string;
}

interface OrderEventData {
  requestId: string;
  beneficiaryId?: string;
  nurseId?: string | null;
  status?: string;
  paymentStatus?: string;
  [key: string]: unknown;
}

interface EmergencyEventData {
  emergencyRequestId: string;
  beneficiaryId?: string;
  nurseId?: string | null;
  status?: string;
  type?: string;
  [key: string]: unknown;
}

interface DeploymentEventData {
  deploymentId: string;
  status?: string;
  creatorId?: string;
  [key: string]: unknown;
}

interface ApplicationEventData {
  deploymentId: string;
  applicationId: string;
  applicantId: string;
  status?: string;
  [key: string]: unknown;
}

interface PaymentEventData {
  deploymentId: string;
  applicationId: string;
  applicantId: string;
  status: string;
  paymentAction: 'submitted' | 'verified' | 'rejected';
  [key: string]: unknown;
}

interface UserEventData {
  userId: string;
  role: string;
  action: 'updated' | 'verified' | 'blocked' | 'unblocked' | 'deleted' | 'availability_changed';
  [key: string]: unknown;
}

// ============================================================================
// HELPER: Emit data_change event (generic) + entity-specific event
// ============================================================================

/**
 * Emit a generic `data_change` event to the admins room + specific user rooms.
 * This is the universal mechanism that triggers cache invalidation on all clients.
 */
function emitDataChange(
  entity: 'order' | 'emergency' | 'deployment' | 'application' | 'payment' | 'user' | 'notification' | 'withdrawal' | 'transaction' | 'complaint' | 'chat' | 'location' | 'rating',
  entityId: string,
  action: 'created' | 'updated' | 'deleted' | 'status_changed',
  data: Record<string, unknown>,
  meta: ChangeMeta,
  /** Additional user IDs to notify directly (e.g., beneficiary, nurse) */
  notifyUserIds: string[] = []
): void {
  const timestamp = new Date().toISOString();

  const dataChangePayload = {
    entity,
    entityId,
    action,
    changedBy: meta.changedBy,
    changedByRole: meta.changedByRole,
    timestamp,
    data,
  };

  // 1. Always emit to admins room (admin + subadmin)
  // Fire-and-forget — don't block the API response
  emitToAdmins('data_change', dataChangePayload).catch(() => {});

  // 2. Emit to specific user rooms if provided
  if (notifyUserIds.length > 0) {
    emitNotificationToUsers(notifyUserIds, {
      type: `data_change_${entity}`,
      priority: action === 'created' ? 'high' : 'medium',
      data: dataChangePayload as unknown as Record<string, string>,
    }).catch(() => {});
  }

  // 3. Emit to role rooms for broad updates
  if (entity === 'order' && (action === 'created' || action === 'status_changed')) {
    emitToRole('nurses', 'data_change', dataChangePayload).catch(() => {});
    emitToRole('beneficiaries', 'data_change', dataChangePayload).catch(() => {});
  }

  if (entity === 'emergency' && (action === 'created' || action === 'status_changed')) {
    emitToRole('nurses', 'data_change', dataChangePayload).catch(() => {});
  }
}

// ============================================================================
// ENTITY-SPECIFIC EMITTERS
// ============================================================================

export const emitRealtimeEvent = {
  // ──────────────────────────────────────────────────────────────────────────
  // ORDERS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when a new order is created by a beneficiary */
  async orderCreated(order: OrderEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [order.beneficiaryId, order.nurseId].filter(Boolean) as string[];

    // Specific event
    emitToAdmins('order_created', {
      ...order,
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    // If nurse is assigned, notify them directly
    if (order.nurseId) {
      emitToUser(order.nurseId, 'order_created', {
        ...order,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // Generic data_change (fire-and-forget)
    emitDataChange('order', order.requestId, 'created', order as Record<string, unknown>, meta, notifyUserIds);
  },

  /** Emit when an order's status changes */
  async orderStatusChanged(order: OrderEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [order.beneficiaryId, order.nurseId].filter(Boolean) as string[];

    // Specific event
    emitToAdmins('order_status_changed', {
      requestId: order.requestId,
      status: order.status,
      nurseId: order.nurseId,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    // Notify affected users
    for (const userId of notifyUserIds) {
      emitToUser(userId, 'order_status_changed', {
        requestId: order.requestId,
        status: order.status,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // Generic data_change (fire-and-forget)
    emitDataChange('order', order.requestId, 'status_changed', order as Record<string, unknown>, meta, notifyUserIds);
  },

  /** Emit when an order is assigned to a nurse */
  async orderAssigned(order: OrderEventData, nurseName?: string, meta?: ChangeMeta): Promise<void> {
    const notifyUserIds = [order.beneficiaryId, order.nurseId].filter(Boolean) as string[];

    emitToAdmins('order_assigned', {
      requestId: order.requestId,
      nurseId: order.nurseId,
      nurseName: nurseName || '',
      assignedBy: meta?.changedBy || '',
      assignedByRole: meta?.changedByRole || '',
      assignedAt: new Date().toISOString(),
    }).catch(() => {});

    // Notify the assigned nurse
    if (order.nurseId) {
      emitToUser(order.nurseId, 'order_assigned', {
        requestId: order.requestId,
        assignedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // Notify beneficiary
    if (order.beneficiaryId) {
      emitToUser(order.beneficiaryId, 'order_assigned', {
        requestId: order.requestId,
        nurseName: nurseName || '',
        assignedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('order', order.requestId, 'updated', order as Record<string, unknown>, meta || { changedBy: '', changedByRole: '' }, notifyUserIds);
  },

  /** Emit when an order is cancelled */
  async orderCancelled(order: OrderEventData, cancelReason?: string, meta?: ChangeMeta): Promise<void> {
    const notifyUserIds = [order.beneficiaryId, order.nurseId].filter(Boolean) as string[];

    emitToAdmins('order_cancelled', {
      requestId: order.requestId,
      cancelledBy: meta?.changedBy || '',
      cancelledByRole: meta?.changedByRole || '',
      cancelReason: cancelReason || null,
      cancelledAt: new Date().toISOString(),
    }).catch(() => {});

    for (const userId of notifyUserIds) {
      emitToUser(userId, 'order_cancelled', {
        requestId: order.requestId,
        cancelReason: cancelReason || null,
        cancelledAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('order', order.requestId, 'status_changed', { ...order, cancelReason } as Record<string, unknown>, meta || { changedBy: '', changedByRole: '' }, notifyUserIds);
  },

  /** Emit when payment status changes on an order */
  async orderPaymentUpdated(order: OrderEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [order.beneficiaryId, order.nurseId].filter(Boolean) as string[];

    emitToAdmins('order_update', {
      requestId: order.requestId,
      paymentStatus: order.paymentStatus,
      status: order.status,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    for (const userId of notifyUserIds) {
      emitToUser(userId, 'order_update', {
        requestId: order.requestId,
        paymentStatus: order.paymentStatus,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('order', order.requestId, 'updated', order as Record<string, unknown>, meta, notifyUserIds);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // EMERGENCIES
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when a new emergency is created */
  async emergencyCreated(emergency: EmergencyEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [emergency.beneficiaryId].filter(Boolean) as string[];

    emitToAdmins('emergency_created', {
      ...emergency,
      createdAt: new Date().toISOString(),
    }).catch(() => {});

    // Notify nearby nurses via role room
    emitToRole('nurses', 'emergency_alert', {
      emergencyRequestId: emergency.emergencyRequestId,
      type: emergency.type,
      location: emergency.beneficiaryId, // Simplified - frontend will fetch full data
    }).catch(() => {});

    emitDataChange('emergency', emergency.emergencyRequestId, 'created', emergency as Record<string, unknown>, meta, notifyUserIds);
  },

  /** Emit when emergency status changes (dispatched, in_progress, resolved, cancelled) */
  async emergencyStatusChanged(emergency: EmergencyEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [emergency.beneficiaryId, emergency.nurseId].filter(Boolean) as string[];

    const eventMap: Record<string, string> = {
      dispatched: 'emergency_dispatched',
      in_progress: 'emergency_update',
      resolved: 'emergency_resolved',
      cancelled: 'emergency_cancelled',
    };

    const specificEvent = eventMap[emergency.status || ''] || 'emergency_update';

    emitToAdmins(specificEvent, {
      emergencyRequestId: emergency.emergencyRequestId,
      status: emergency.status,
      nurseId: emergency.nurseId,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    // Notify affected users
    for (const userId of notifyUserIds) {
      emitToUser(userId, specificEvent, {
        emergencyRequestId: emergency.emergencyRequestId,
        status: emergency.status,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('emergency', emergency.emergencyRequestId, 'status_changed', emergency as Record<string, unknown>, meta, notifyUserIds);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DEPLOYMENTS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when a deployment is created or updated */
  async deploymentChanged(deployment: DeploymentEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [deployment.creatorId].filter(Boolean) as string[];

    emitToAdmins('deployment_updated', {
      deploymentId: deployment.deploymentId,
      status: deployment.status,
      updatedBy: meta.changedBy,
      updatedByRole: meta.changedByRole,
      updatedAt: new Date().toISOString(),
      deployment,
    }).catch(() => {});

    for (const userId of notifyUserIds) {
      emitToUser(userId, 'deployment_updated', {
        deploymentId: deployment.deploymentId,
        status: deployment.status,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('deployment', deployment.deploymentId, 'updated', deployment as Record<string, unknown>, meta, notifyUserIds);
  },

  /** Emit when an application status changes */
  async applicationChanged(application: ApplicationEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [application.applicantId].filter(Boolean) as string[];

    emitToAdmins('application_updated', {
      deploymentId: application.deploymentId,
      applicationId: application.applicationId,
      applicantId: application.applicantId,
      status: application.status,
      updatedBy: meta.changedBy,
      updatedByRole: meta.changedByRole,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    for (const userId of notifyUserIds) {
      emitToUser(userId, 'application_updated', {
        deploymentId: application.deploymentId,
        applicationId: application.applicationId,
        status: application.status,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('application', application.applicationId, 'updated', application as Record<string, unknown>, meta, notifyUserIds);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PAYMENTS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when payment proof is submitted, verified, or rejected */
  async paymentChanged(payment: PaymentEventData, meta: ChangeMeta): Promise<void> {
    const notifyUserIds = [payment.applicantId].filter(Boolean) as string[];

    emitToAdmins('payment_updated', {
      deploymentId: payment.deploymentId,
      applicationId: payment.applicationId,
      applicantId: payment.applicantId,
      status: payment.status,
      paymentAction: payment.paymentAction,
      updatedBy: meta.changedBy,
      updatedByRole: meta.changedByRole,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    // Notify applicant
    for (const userId of notifyUserIds) {
      emitToUser(userId, 'payment_updated', {
        deploymentId: payment.deploymentId,
        applicationId: payment.applicationId,
        status: payment.status,
        paymentAction: payment.paymentAction,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    emitDataChange('payment', payment.applicationId, 'updated', payment as Record<string, unknown>, meta, notifyUserIds);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // USERS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when user data changes (nurse verified, blocked, profile updated, etc.) */
  async userChanged(user: UserEventData, meta: ChangeMeta): Promise<void> {
    // Notify admins
    emitToAdmins('data_change', {
      entity: 'user',
      entityId: user.userId,
      action: user.action,
      changedBy: meta.changedBy,
      changedByRole: meta.changedByRole,
      timestamp: new Date().toISOString(),
      data: user as Record<string, unknown>,
    }).catch(() => {});

    // Notify the user themselves (e.g., "your account has been verified")
    emitToUser(user.userId, 'data_change', {
      entity: 'user',
      entityId: user.userId,
      action: user.action,
      timestamp: new Date().toISOString(),
      data: user as Record<string, unknown>,
    }).catch(() => {});
  },

  // ──────────────────────────────────────────────────────────────────────────
  // WITHDRAWALS / TRANSACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when a withdrawal request is created or processed */
  async withdrawalChanged(withdrawalId: string, nurseId: string, status: string, meta: ChangeMeta): Promise<void> {
    emitToAdmins('data_change', {
      entity: 'withdrawal',
      entityId: withdrawalId,
      action: 'updated',
      changedBy: meta.changedBy,
      changedByRole: meta.changedByRole,
      timestamp: new Date().toISOString(),
      data: { withdrawalId, status },
    }).catch(() => {});

    emitToUser(nurseId, 'data_change', {
      entity: 'withdrawal',
      entityId: withdrawalId,
      action: 'updated',
      timestamp: new Date().toISOString(),
      data: { withdrawalId, status },
    }).catch(() => {});
  },

  /** Emit when a transaction is updated */
  async transactionChanged(transactionId: string, userIds: string[], status: string, meta: ChangeMeta): Promise<void> {
    emitToAdmins('data_change', {
      entity: 'transaction',
      entityId: transactionId,
      action: 'updated',
      changedBy: meta.changedBy,
      changedByRole: meta.changedByRole,
      timestamp: new Date().toISOString(),
      data: { transactionId, status },
    }).catch(() => {});

    for (const userId of userIds) {
      emitToUser(userId, 'data_change', {
        entity: 'transaction',
        entityId: transactionId,
        action: 'updated',
        timestamp: new Date().toISOString(),
        data: { transactionId, status },
      }).catch(() => {});
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // COMPLAINTS
  // ──────────────────────────────────────────────────────────────────────────

  /** Emit when a complaint is created or resolved */
  async complaintChanged(complaintId: string, beneficiaryId: string, status: string, meta: ChangeMeta): Promise<void> {
    emitToAdmins('data_change', {
      entity: 'complaint',
      entityId: complaintId,
      action: 'updated',
      changedBy: meta.changedBy,
      changedByRole: meta.changedByRole,
      timestamp: new Date().toISOString(),
      data: { complaintId, status },
    }).catch(() => {});

    emitToUser(beneficiaryId, 'data_change', {
      entity: 'complaint',
      entityId: complaintId,
      action: 'updated',
      timestamp: new Date().toISOString(),
      data: { complaintId, status },
    }).catch(() => {});
  },
};
