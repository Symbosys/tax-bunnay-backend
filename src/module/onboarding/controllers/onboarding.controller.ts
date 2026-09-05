import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { SuccessResponse } from "../../../utils/response.util";
import { onboardingService, OnboardingService } from "../services/onboarding.service";
import {
  onboardOrganizationSchema,
  validateGstinSchema,
  checkNameAvailabilitySchema,
} from "../validators/onboarding.validators";

export class OnboardingController {
  private service: OnboardingService;

  constructor(service: OnboardingService = onboardingService) {
    this.service = service;
  }

  /**
   * Complete Organization Onboarding Setup
   * POST /api/v1/onboarding/organization
   */
  onboardOrganization = asyncHandler(async (req: Request, res: Response) => {
    // 1. Validate request payload with Zod
    const validatedData = onboardOrganizationSchema.parse(req.body);

    // 2. Extract request metadata
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket?.remoteAddress ||
      req.ip;
    const deviceInfo = (req.headers["user-agent"] as string) || "Unknown Device";
    const platform = (req.body.platform as string) || "WEB";

    // 3. Delegate to onboarding service
    const result = await this.service.onboardOrganization(validatedData, {
      ipAddress,
      deviceInfo,
      platform,
    });

    // 4. Return 201 Created response
    return SuccessResponse(
      res,
      `Organization "${result.organization.businessName}" onboarded and provisioned successfully!`,
      result,
      201
    );
  });

  /**
   * Validate GSTIN and decode metadata
   * POST /api/v1/onboarding/validate-gstin
   */
  validateGstin = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validateGstinSchema.parse(req.body);
    const result = await this.service.validateGstin(validatedData);

    return SuccessResponse(res, "GSTIN validation completed", result, 200);
  });

  /**
   * Check Organization Name & Domain Availability
   * GET /api/v1/onboarding/check-name
   */
  checkNameAvailability = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = checkNameAvailabilitySchema.parse({
      name: (req.query.name as string) || "",
    });

    const result = await this.service.checkOrganizationName(validatedData);

    return SuccessResponse(res, "Name availability checked", result, 200);
  });

  /**
   * Get all active SaaS plans
   * GET /api/v1/onboarding/plans
   */
  getPlans = asyncHandler(async (_req: Request, res: Response) => {
    const plans = await this.service.getAvailablePlans();

    return SuccessResponse(res, "Available SaaS plans retrieved", plans, 200);
  });

  /**
   * Get Organization setup details by ID
   * GET /api/v1/onboarding/organization/:id
   */
  getOrganizationDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const organization = await this.service.getOrganizationDetails(id);

      return SuccessResponse(
        res,
        "Organization details retrieved successfully",
        organization,
        200
      );
    }
  );

  /**
   * List all onboarded organizations (Platform Admin / Overview)
   * GET /api/v1/onboarding/organizations
   */
  listOrganizations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const offset = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;

      const result = await this.service.listRecentOrganizations(limit, offset);

      return SuccessResponse(
        res,
        "Organizations list retrieved successfully",
        result,
        200
      );
    }
  );
}

export const onboardingController = new OnboardingController();
