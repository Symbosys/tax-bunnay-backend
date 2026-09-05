import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { SuccessResponse } from "../../../../utils/response.util";
import {
  PlatformOrganizationService,
  platformOrganizationService,
} from "../services/organization.service";
import {
  createPlatformOrganizationSchema,
  platformOrganizationQuerySchema,
  togglePlatformOrganizationStatusSchema,
  updatePlatformOrganizationSchema,
} from "../validators/organization.validators";

export class PlatformOrganizationController {
  private service: PlatformOrganizationService;

  constructor(service: PlatformOrganizationService = platformOrganizationService) {
    this.service = service;
  }

  /**
   * List all provisioned organizations with search, status filters & summary KPIs
   * GET /api/v1/platform-admin/organizations
   */
  listOrganizations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const validatedQuery = platformOrganizationQuerySchema.parse(req.query);
      const result = await this.service.listOrganizations(validatedQuery);

      return SuccessResponse(
        res,
        "Organizations directory retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * Get Platform KPIs (MRR, ARR, active tenants, total users, uptime)
   * GET /api/v1/platform-admin/organizations/kpis
   */
  getKPIs = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const kpis = await this.service.getOrganizationKPIs();

    return SuccessResponse(
      res,
      "Platform organization KPIs retrieved successfully",
      kpis,
      200
    );
  });

  /**
   * Get single organization details by ID
   * GET /api/v1/platform-admin/organizations/:id
   */
  getOrganizationDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const organization = await this.service.getOrganizationById(id);

      return SuccessResponse(
        res,
        "Organization details retrieved successfully",
        organization,
        200
      );
    }
  );

  /**
   * Provision a new Tenant Organization
   * POST /api/v1/platform-admin/organizations
   */
  createOrganization = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const validatedData = createPlatformOrganizationSchema.parse(req.body);
      const organization = await this.service.createOrganization(validatedData);

      return SuccessResponse(
        res,
        `Organization "${organization.name}" created and provisioned successfully!`,
        organization,
        201
      );
    }
  );

  /**
   * Update Tenant Organization details
   * PUT /api/v1/platform-admin/organizations/:id
   */
  updateOrganization = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const validatedData = updatePlatformOrganizationSchema.parse(req.body);
      const updated = await this.service.updateOrganization(id, validatedData);

      return SuccessResponse(
        res,
        `Organization "${updated.name}" updated successfully!`,
        updated,
        200
      );
    }
  );

  /**
   * Fast toggle organization status (Active, Suspended, Trial)
   * PATCH /api/v1/platform-admin/organizations/:id/status
   */
  toggleStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const { status } = togglePlatformOrganizationStatusSchema.parse(req.body);
      const updated = await this.service.toggleStatus(id, status);

      return SuccessResponse(
        res,
        `Organization "${updated.name}" status changed to ${status.toUpperCase()}`,
        updated,
        200
      );
    }
  );

  /**
   * Delete / Suspend Tenant Organization
   * DELETE /api/v1/platform-admin/organizations/:id
   */
  deleteOrganization = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const result = await this.service.deleteOrganization(id);

      return SuccessResponse(
        res,
        result.message,
        result,
        200
      );
    }
  );

  /**
   * Impersonate Tenant: Platform Admin logs in as the tenant organization owner
   * POST /api/v1/platform-admin/organizations/:id/impersonate
   */
  impersonateTenant = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const id = req.params.id as string;
      const currentAdminId = req.user?.id as string | undefined;

      const result = await this.service.generateImpersonationToken(
        id,
        currentAdminId
      );

      return SuccessResponse(
        res,
        `Impersonation session established for "${result.organization.name}"`,
        result,
        200
      );
    }
  );
}

export const platformOrganizationController = new PlatformOrganizationController();
