import type { Response, Request } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util";
import {
  SubscriptionService,
  subscriptionService,
} from "../services/subscription.service";
import { subscribePlanSchema } from "../validators/subscription.validators";

export class SubscriptionController {
  private service: SubscriptionService;

  constructor(service: SubscriptionService = subscriptionService) {
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
   * GET /api/v1/subscriptions/plans
   * Retrieve all active SaaS plans (created by Platform Admin)
   */
  getPlans = asyncHandler(async (_req: Request, res: Response) => {
    const plans = await this.service.getAvailablePlans();
    return SuccessResponse(
      res,
      "SaaS subscription plans retrieved successfully",
      plans,
      200
    );
  });

  /**
   * GET /api/v1/subscriptions/active
   * Retrieve current active subscription for the authenticated organization
   */
  getActiveSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      if (!businessId) {
        throw new ErrorResponse(
          "Active Business ID is required. Please supply X-Business-ID header.",
          400
        );
      }

      const activeSub = await this.service.getActiveSubscription(businessId);
      return SuccessResponse(
        res,
        "Active subscription retrieved successfully",
        activeSub,
        200
      );
    }
  );

  /**
   * POST /api/v1/subscriptions/subscribe
   * Purchase / upgrade to a SaaS plan
   */
  subscribe = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      if (!businessId) {
        throw new ErrorResponse(
          "Active Business ID is required. Please supply X-Business-ID header.",
          400
        );
      }

      const validatedInput = subscribePlanSchema.parse(req.body);
      const result = await this.service.purchasePlan(businessId, validatedInput);

      return SuccessResponse(res, result.message, result, 200);
    }
  );
}

export const subscriptionController = new SubscriptionController();
