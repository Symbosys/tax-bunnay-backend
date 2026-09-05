import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { SuccessResponse } from "../../../../utils/response.util";
import {
  PlatformPlanService,
  platformPlanService,
} from "../services/plan.service";
import {
  createPlanSchema,
  updatePlanSchema,
} from "../validators/plan.validators";

export class PlatformPlanController {
  private service: PlatformPlanService;

  constructor(service: PlatformPlanService = platformPlanService) {
    this.service = service;
  }

  /**
   * Get all active SaaS subscription plans
   * GET /api/v1/platform-admin/plans
   */
  getPlans = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const plans = await this.service.getAllPlans();
    return SuccessResponse(res, "Subscription plans retrieved successfully", plans, 200);
  });

  /**
   * Create a new SaaS subscription plan
   * POST /api/v1/platform-admin/plans
   */
  createPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createPlanSchema.parse(req.body);
    const plan = await this.service.createPlan(validatedData);
    return SuccessResponse(
      res,
      `Subscription plan "${plan.name}" created successfully!`,
      plan,
      201
    );
  });

  /**
   * Update an existing SaaS subscription plan
   * PUT /api/v1/platform-admin/plans/:id
   */
  updatePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const validatedData = updatePlanSchema.parse(req.body);
    const plan = await this.service.updatePlan(id, validatedData);
    return SuccessResponse(
      res,
      `Subscription plan "${plan.name}" updated successfully!`,
      plan,
      200
    );
  });

  /**
   * Delete a SaaS subscription plan
   * DELETE /api/v1/platform-admin/plans/:id
   */
  deletePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const result = await this.service.deletePlan(id);
    return SuccessResponse(res, result.message, result, 200);
  });
}

export const platformPlanController = new PlatformPlanController();
