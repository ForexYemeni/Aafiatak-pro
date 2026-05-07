// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Server (MongoDB Only)
// ============================================================================
// Server-side notification system using MongoDB only - NO Firebase.
// Stores notifications in MongoDB and supports voice notifications from DB.
// Browser notifications use the Web Notification API directly.
// ============================================================================

import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose/Notification';

// ============================================================================
// Types
// ============================================================================

/** Options for creating a notification */
export interface SendNotificationOptions {
  /** Target user ID */
  userId: string;
  /** Target user role */
  userRole: string;
  /** Notification title (Arabic) */
  title: string;
  /** Notification body (Arabic) */
  body: string;
  /** Notification type */
  type?: string;
  /** Message priority */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Custom data payload */
  data?: Record<string, string>;
  /** Action URL for click navigation */
  clickAction?: string;
  /** Enable voice notification */
  voiceEnabled?: boolean;
}

/** Options for sending to multiple users */
export interface MultiUserNotificationOptions extends Omit<SendNotificationOptions, 'userId'> {
  /** Target user IDs */
  userIds: string[];
  /** Target user role */
  userRole: string;
}

// ============================================================================
// Create Notification in MongoDB
// ============================================================================

/**
 * Create a notification in MongoDB.
 * This stores the notification and makes it available for:
 * 1. In-app notification display
 * 2. Browser push notifications (via service worker)
 * 3. Voice notifications (TTS from stored data)
 *
 * @param options - Notification options
 */
export async function sendNotification(options: SendNotificationOptions): Promise<string | null> {
  try {
    await connectDB();

    const notification = await Notification.create({
      userId: options.userId,
      userRole: options.userRole,
      titleAr: options.title,
      bodyAr: options.body,
      type: options.type || 'system',
      priority: options.priority || 'medium',
      data: options.data || {},
      read: false,
      actionUrl: options.clickAction || undefined,
      voiceEnabled: options.voiceEnabled !== false,
    });

    console.info(`[NotificationService] Notification created for user ${options.userId}: ${options.title}`);
    return notification._id.toString();
  } catch (error) {
    console.error('[NotificationService] Failed to create notification:', error);
    return null;
  }
}

/**
 * Send notification to multiple users.
 * Creates individual notification records in MongoDB for each user.
 *
 * @param options - Multi-user notification options
 */
export async function sendMultiUserNotification(
  options: MultiUserNotificationOptions
): Promise<{ successCount: number; failureCount: number }> {
  let successCount = 0;
  let failureCount = 0;

  for (const userId of options.userIds) {
    const result = await sendNotification({
      userId,
      userRole: options.userRole,
      title: options.title,
      body: options.body,
      type: options.type,
      priority: options.priority,
      data: options.data,
      clickAction: options.clickAction,
      voiceEnabled: options.voiceEnabled,
    });

    if (result) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.info(
    `[NotificationService] Multi-user notification: ${successCount} success, ${failureCount} failure`
  );
  return { successCount, failureCount };
}

/**
 * Send a role-based notification to all users of a specific role.
 *
 * @param role - The target role
 * @param options - Notification options (without userId)
 */
export async function sendRoleNotification(
  role: string,
  title: string,
  body: string,
  options?: Partial<SendNotificationOptions>
): Promise<{ successCount: number; failureCount: number }> {
  try {
    await connectDB();

    // Dynamic import to get the right model based on role
    let Model;
    if (role === 'nurse') {
      const { Nurse } = await import('@/models/mongoose/Nurse');
      Model = Nurse;
    } else if (role === 'beneficiary') {
      const { Beneficiary } = await import('@/models/mongoose/Beneficiary');
      Model = Beneficiary;
    } else {
      const { User } = await import('@/models/mongoose/User');
      Model = User;
    }

    const users = await Model.find({ isActive: true }).select('_id').lean();
    const userIds = users.map((u: any) => u._id.toString());

    return sendMultiUserNotification({
      userIds,
      userRole: role,
      title,
      body,
      ...options,
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send role notification:', error);
    return { successCount: 0, failureCount: 1 };
  }
}

// ============================================================================
// Get Unread Count for a User
// ============================================================================

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    await connectDB();
    return Notification.countDocuments({ userId, read: false });
  } catch {
    return 0;
  }
}

// ============================================================================
// Mark Notifications as Read
// ============================================================================

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    await connectDB();
    const result = await Notification.updateOne(
      { _id: notificationId, userId },
      { read: true }
    );
    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

export async function markAllAsRead(userId: string): Promise<number> {
  try {
    await connectDB();
    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    return result.modifiedCount;
  } catch {
    return 0;
  }
}

// ============================================================================
// Mark Voice as Played
// ============================================================================

export async function markVoicePlayed(notificationId: string, userId: string): Promise<boolean> {
  try {
    await connectDB();
    const result = await Notification.updateOne(
      { _id: notificationId, userId, voiceEnabled: true },
      { voicePlayedAt: new Date() }
    );
    return result.modifiedCount > 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Get Voice-Pending Notifications (for voice notification polling)
// ============================================================================

export async function getVoicePendingNotifications(userId: string): Promise<any[]> {
  try {
    await connectDB();
    return Notification.find({
      userId,
      voiceEnabled: true,
      voicePlayedAt: { $exists: false },
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
  } catch {
    return [];
  }
}
