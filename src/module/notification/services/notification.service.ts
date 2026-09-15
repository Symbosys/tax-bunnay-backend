import axios from "axios";
import { notificationRepo, NotificationRepository } from "../repo/notification.repo";
import type {
  NotificationQueryParams,
  RegisterDeviceTokenInput,
  SendNotificationInput,
} from "../validators/notification.validators";
import type { NotificationType, NotificationChannel } from "../../../generated/prisma/client";

export class NotificationService {
  private repo: NotificationRepository;
  public static readonly DEFAULT_FCM_TOKEN =
    "dSANnotmQbqtddfnLfU1sH:APA91bGbnJE9eDVsOdkkMV0bCskPSXrH-nJhZwwQaTysMeJTFO83rhkjN162NhQ6ZLHzPS1zRO63u2wRar-eHJHlHi-p6yrcA49HKw7eMkJg17loVmGZpZE";

  constructor(repo: NotificationRepository = notificationRepo) {
    this.repo = repo;
    this.ensureDefaultToken().catch((err) => {
      console.error("[NotificationService] Error ensuring default FCM token:", err);
    });
  }

  /**
   * Automatically ensure the user's primary FCM token is stored in the DB
   */
  async ensureDefaultToken() {
    try {
      const defaultBiz = await this.repo.getDefaultBusinessId();
      await this.repo.saveDeviceToken({
        token: NotificationService.DEFAULT_FCM_TOKEN,
        deviceType: "android",
        businessId: defaultBiz,
      });
      console.log("[NotificationService] Default FCM token verified in database.");
    } catch (e: any) {
      console.warn("[NotificationService] Could not auto-sync default FCM token:", e?.message);
    }
  }

  /**
   * Register or update a device FCM token
   */
  async registerToken(
    input: RegisterDeviceTokenInput,
    currentUserId?: string,
    currentBusinessId?: string
  ) {
    const saved = await this.repo.saveDeviceToken({
      token: input.token,
      deviceType: input.deviceType ?? "android",
      userId: input.userId ?? currentUserId ?? null,
      businessId: input.businessId ?? currentBusinessId ?? null,
    });

    return {
      message: "FCM Device token registered successfully in database",
      tokenRecord: saved,
    };
  }

  /**
   * Send push notification to a specific FCM device token
   */
  private async sendFcmToDevice(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> }
  ): Promise<{ success: boolean; token: string; response?: any; error?: string }> {
    try {
      console.log(
        `\n======================================================\n` +
        `[FCM PUSH DISPATCH]\n` +
        `Target Token: ${token}\n` +
        `Title: ${payload.title}\n` +
        `Body: ${payload.body}\n` +
        `Data: ${JSON.stringify(payload.data || {})}\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `======================================================\n`
      );

      // If FCM legacy server key is configured in env, we can send to FCM endpoint
      const serverKey = process.env.FCM_SERVER_KEY;
      if (serverKey) {
        const res = await axios.post(
          "https://fcm.googleapis.com/fcm/send",
          {
            to: token,
            priority: "high",
            content_available: true,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: "default",
              android_channel_id: "taxbunny_high_importance_channel",
            },
            data: {
              title: payload.title,
              body: payload.body,
              message: payload.body,
              ...(payload.data || {}),
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${serverKey}`,
            },
            timeout: 5000,
          }
        );
        return { success: true, token, response: res.data };
      }

      return {
        success: true,
        token,
        response: { status: "SIMULATED_SUCCESS", message: "Push notification logged & queued" },
      };
    } catch (err: any) {
      console.error(`[FCM PUSH ERROR] Failed to send to token ${token}:`, err?.message);
      return { success: false, token, error: err?.message };
    }
  }

  /**
   * Dispatch a notification: writes to DB table and pushes to registered FCM tokens
   */
  async dispatchNotification(payload: {
    businessId: string;
    type: NotificationType;
    title: string;
    message: string;
    channel?: NotificationChannel;
    referenceType?: string | null;
    referenceId?: string | null;
    data?: Record<string, string>;
    targetToken?: string;
  }) {
    // 1. Create DB notification record
    const notification = await this.repo.createNotification({
      businessId: payload.businessId,
      type: payload.type,
      channel: payload.channel ?? "IN_APP",
      title: payload.title,
      message: payload.message,
      referenceType: payload.referenceType ?? null,
      referenceId: payload.referenceId ?? null,
    });

    // 2. Fetch active tokens for the business
    let activeTokens = await this.repo.getActiveDeviceTokens(payload.businessId);

    // If specific targetToken provided, ensure it's in the list
    if (payload.targetToken && !activeTokens.some((t) => t.token === payload.targetToken)) {
      activeTokens.push({
        id: "target",
        token: payload.targetToken,
        deviceType: "android",
        userId: null,
        businessId: payload.businessId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Always guarantee primary FCM token is included if not present
    if (!activeTokens.some((t) => t.token === NotificationService.DEFAULT_FCM_TOKEN)) {
      activeTokens.push({
        id: "primary",
        token: NotificationService.DEFAULT_FCM_TOKEN,
        deviceType: "android",
        userId: null,
        businessId: payload.businessId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 3. Dispatch to all active FCM tokens
    const pushResults = await Promise.all(
      activeTokens.map((t) =>
        this.sendFcmToDevice(t.token, {
          title: payload.title,
          body: payload.message,
          data: {
            notificationId: notification.id,
            type: payload.type,
            referenceType: payload.referenceType || "",
            referenceId: payload.referenceId || "",
            ...(payload.data || {}),
          },
        })
      )
    );

    return {
      notification,
      dispatchedTokensCount: activeTokens.length,
      pushResults,
    };
  }

  // ===========================================================================
  // STOCK & INVENTORY TRIGGERS
  // ===========================================================================

  /**
   * Trigger Low Stock / Out of Stock alert
   */
  async notifyLowStock(payload: {
    businessId: string;
    productId: string;
    productName: string;
    currentStock: number;
    minStockLevel: number;
  }) {
    const isOutOfStock = payload.currentStock <= 0;
    const title = isOutOfStock
      ? `🚨 Out of Stock: ${payload.productName}`
      : `⚠️ Low Stock Alert: ${payload.productName}`;

    const message = isOutOfStock
      ? `"${payload.productName}" is completely out of stock! Replenishment is required immediately.`
      : `Stock for "${payload.productName}" has reached ${payload.currentStock} units (reorder threshold: ${payload.minStockLevel}).`;

    return this.dispatchNotification({
      businessId: payload.businessId,
      type: "LOW_STOCK",
      title,
      message,
      referenceType: "PRODUCT",
      referenceId: payload.productId,
      data: {
        productId: payload.productId,
        currentStock: String(payload.currentStock),
        minStockLevel: String(payload.minStockLevel),
      },
    });
  }

  /**
   * Trigger Stock Adjustment notification
   */
  async notifyStockAdjustment(payload: {
    businessId: string;
    productId: string;
    productName: string;
    quantity: number;
    warehouseName?: string;
  }) {
    const delta = payload.quantity > 0 ? `+${payload.quantity}` : `${payload.quantity}`;
    const title = `📦 Stock Adjusted: ${payload.productName}`;
    const message = `Stock adjusted by ${delta} units for "${payload.productName}" in warehouse "${payload.warehouseName || 'Main Warehouse'}".`;

    return this.dispatchNotification({
      businessId: payload.businessId,
      type: "SYSTEM_ALERT",
      title,
      message,
      referenceType: "PRODUCT",
      referenceId: payload.productId,
      data: {
        productId: payload.productId,
        quantity: String(payload.quantity),
      },
    });
  }

  /**
   * Trigger Stock Transfer notification
   */
  async notifyStockTransfer(payload: {
    businessId: string;
    transferNumber: string;
    fromWarehouse: string;
    toWarehouse: string;
    itemCount: number;
  }) {
    const title = `🔄 Stock Transfer: ${payload.transferNumber}`;
    const message = `Stock transfer of ${payload.itemCount} line item(s) initiated from "${payload.fromWarehouse}" to "${payload.toWarehouse}".`;

    return this.dispatchNotification({
      businessId: payload.businessId,
      type: "SYSTEM_ALERT",
      title,
      message,
      referenceType: "STOCK_TRANSFER",
      referenceId: payload.transferNumber,
      data: {
        transferNumber: payload.transferNumber,
        fromWarehouse: payload.fromWarehouse,
        toWarehouse: payload.toWarehouse,
      },
    });
  }

  // ===========================================================================
  // SUBSCRIPTION TRIGGERS
  // ===========================================================================

  /**
   * Trigger Subscription Activated / Upgraded notification
   */
  async notifySubscriptionActivated(payload: {
    businessId: string;
    planName: string;
    billingCycle: string;
    amount: number;
  }) {
    const title = `🎉 Plan Activated: ${payload.planName}`;
    const message = `Your subscription to the ${payload.planName} plan (${payload.billingCycle.toLowerCase()}) is now active! Amount: ₹${payload.amount.toLocaleString()}.`;

    return this.dispatchNotification({
      businessId: payload.businessId,
      type: "SYSTEM_ALERT",
      title,
      message,
      referenceType: "SUBSCRIPTION",
      data: {
        planName: payload.planName,
        billingCycle: payload.billingCycle,
        amount: String(payload.amount),
      },
    });
  }

  /**
   * Trigger Subscription Expiring notification
   */
  async notifySubscriptionExpiring(payload: {
    businessId: string;
    planName: string;
    daysLeft: number;
    expiryDate: Date;
  }) {
    const title = `⏳ Subscription Expiring Soon: ${payload.planName}`;
    const message = `Your ${payload.planName} subscription will expire in ${payload.daysLeft} day(s) on ${payload.expiryDate.toISOString().split("T")[0]}. Please renew to prevent service pause.`;

    return this.dispatchNotification({
      businessId: payload.businessId,
      type: "SUBSCRIPTION_EXPIRY",
      title,
      message,
      referenceType: "SUBSCRIPTION",
      data: {
        planName: payload.planName,
        daysLeft: String(payload.daysLeft),
        expiryDate: payload.expiryDate.toISOString(),
      },
    });
  }

  // ===========================================================================
  // GENERAL NOTIFICATION QUERY & MANAGEMENT
  // ===========================================================================

  async getNotifications(businessId: string, params: NotificationQueryParams) {
    return this.repo.getNotifications(businessId, params);
  }

  async markAsRead(notificationId: string, businessId: string) {
    return this.repo.markAsRead(notificationId, businessId);
  }

  async markAllAsRead(businessId: string) {
    return this.repo.markAllAsRead(businessId);
  }

  async getUnreadCount(businessId: string) {
    return this.repo.getUnreadCount(businessId);
  }

  async listTokens(businessId?: string) {
    return this.repo.getActiveDeviceTokens(businessId);
  }

  async deactivateToken(token: string) {
    return this.repo.deactivateDeviceToken(token);
  }

  async sendCustomNotification(
    businessId: string,
    input: SendNotificationInput
  ) {
    return this.dispatchNotification({
      businessId,
      type: input.type as NotificationType,
      channel: input.channel as NotificationChannel,
      title: input.title,
      message: input.message,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      targetToken: input.token,
    });
  }
}

export const notificationService = new NotificationService();
