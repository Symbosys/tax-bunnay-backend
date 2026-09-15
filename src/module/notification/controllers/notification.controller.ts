import type { Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util";
import {
  NotificationService,
  notificationService,
} from "../services/notification.service";
import {
  notificationQuerySchema,
  registerDeviceTokenSchema,
  sendNotificationSchema,
} from "../validators/notification.validators";

export class NotificationController {
  private service: NotificationService;

  constructor(service: NotificationService = notificationService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, query, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    const headerId = (req.headers["x-business-id"] ||
      req.headers["X-Business-ID"]) as string;
    if (headerId && headerId.trim().length > 0) {
      return headerId.trim();
    }

    if (req.query.businessId && typeof req.query.businessId === "string") {
      return req.query.businessId.trim();
    }

    if (req.body?.businessId && typeof req.body.businessId === "string") {
      return req.body.businessId.trim();
    }

    if (req.user?.ownedBusinesses && req.user.ownedBusinesses.length > 0) {
      return req.user.ownedBusinesses[0].id;
    }

    if (
      req.user?.businessMemberships &&
      req.user.businessMemberships.length > 0
    ) {
      return req.user.businessMemberships[0].businessId;
    }

    return "";
  }

  /**
   * POST /api/v1/notifications/token
   * Register or update an FCM device token in the database
   */
  registerToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const input = registerDeviceTokenSchema.parse(req.body);
    const businessId = this.extractBusinessId(req);

    const result = await this.service.registerToken(
      input,
      req.user?.id,
      businessId || undefined
    );

    return SuccessResponse(
      res,
      result.message,
      result.tokenRecord,
      201
    );
  });

  /**
   * GET /api/v1/notifications/tokens
   * List active device tokens for the current business
   */
  getTokens = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const tokens = await this.service.listTokens(businessId || undefined);

    return SuccessResponse(
      res,
      "Active device tokens retrieved successfully",
      tokens,
      200
    );
  });

  /**
   * DELETE /api/v1/notifications/token
   * Deactivate a device token
   */
  deactivateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const token = (req.body?.token || req.query?.token) as string;
    if (!token) {
      throw new ErrorResponse("Device token is required", 400);
    }

    await this.service.deactivateToken(token);
    return SuccessResponse(res, "Device token deactivated successfully", null, 200);
  });

  /**
   * GET /api/v1/notifications
   * Get paginated notifications for current business
   */
  getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const query = notificationQuerySchema.parse(req.query);
    const result = await this.service.getNotifications(businessId, query);

    return SuccessResponse(
      res,
      "Notifications retrieved successfully",
      result,
      200
    );
  });

  /**
   * GET /api/v1/notifications/unread-count
   * Return total unread notifications count
   */
  getUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const count = await this.service.getUnreadCount(businessId);
    return SuccessResponse(res, "Unread count retrieved", { unreadCount: count }, 200);
  });

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a specific notification as read
   */
  markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const id = String(req.params.id || "");
    if (!id) {
      throw new ErrorResponse("Notification ID is required", 400);
    }
    await this.service.markAsRead(id, businessId);

    return SuccessResponse(res, "Notification marked as read", null, 200);
  });

  /**
   * PATCH /api/v1/notifications/mark-all-read
   * Mark all notifications for business as read
   */
  markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    await this.service.markAllAsRead(businessId);
    return SuccessResponse(res, "All notifications marked as read", null, 200);
  });

  /**
   * POST /api/v1/notifications/test-send
   * Trigger test push notification to active tokens
   */
  sendTestNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const input = sendNotificationSchema.parse(req.body);
    const result = await this.service.sendCustomNotification(businessId, input);

    return SuccessResponse(
      res,
      "Test notification dispatched successfully",
      result,
      200
    );
  });
}

export const notificationController = new NotificationController();
