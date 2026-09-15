import { prisma } from "../../../db/prisma";
import type { NotificationType, NotificationChannel } from "../../../generated/prisma/client";
import type { NotificationQueryParams } from "../validators/notification.validators";

export class NotificationRepository {
  /**
   * Save or update an FCM device token in the database
   */
  async saveDeviceToken(data: {
    token: string;
    deviceType?: string;
    userId?: string | null;
    businessId?: string | null;
  }) {
    const existing = await prisma.deviceToken.findUnique({
      where: { token: data.token },
    });

    if (existing) {
      return prisma.deviceToken.update({
        where: { token: data.token },
        data: {
          isActive: true,
          deviceType: data.deviceType ?? existing.deviceType,
          userId: data.userId ?? existing.userId,
          businessId: data.businessId ?? existing.businessId,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.deviceToken.create({
      data: {
        token: data.token,
        deviceType: data.deviceType ?? "android",
        userId: data.userId ?? null,
        businessId: data.businessId ?? null,
        isActive: true,
      },
    });
  }

  /**
   * Get all active device tokens, optionally filtered by businessId or userId
   */
  async getActiveDeviceTokens(businessId?: string, userId?: string) {
    const where: any = { isActive: true };

    if (businessId && userId) {
      where.OR = [
        { businessId },
        { userId },
        { businessId: null, userId: null },
      ];
    } else if (businessId) {
      where.OR = [
        { businessId },
        { businessId: null },
      ];
    } else if (userId) {
      where.OR = [
        { userId },
        { userId: null },
      ];
    }

    return prisma.deviceToken.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Deactivate a device token (e.g. on logout or invalid token)
   */
  async deactivateDeviceToken(token: string) {
    return prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false, updatedAt: new Date() },
    });
  }

  /**
   * Create and persist a notification record in PostgreSQL
   */
  async createNotification(data: {
    businessId: string;
    type: NotificationType;
    channel?: NotificationChannel;
    title: string;
    message: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    return prisma.notification.create({
      data: {
        businessId: data.businessId,
        type: data.type,
        channel: data.channel ?? "IN_APP",
        title: data.title,
        message: data.message,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Retrieve paginated notifications for a business
   */
  async getNotifications(businessId: string, params: NotificationQueryParams) {
    const where: any = { businessId };

    if (params.isRead !== undefined) {
      where.isRead = params.isRead;
    }

    if (params.type) {
      where.type = params.type as NotificationType;
    }

    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, businessId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, businessId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications for a business as read
   */
  async markAllAsRead(businessId: string) {
    return prisma.notification.updateMany({
      where: { businessId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(businessId: string) {
    return prisma.notification.count({
      where: { businessId, isRead: false },
    });
  }

  /**
   * Fetch fallback default business ID if needed
   */
  async getDefaultBusinessId(): Promise<string | null> {
    const biz = await prisma.business.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return biz?.id ?? null;
  }
}

export const notificationRepo = new NotificationRepository();
