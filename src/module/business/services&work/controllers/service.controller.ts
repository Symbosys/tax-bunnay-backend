import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { serviceService, ServiceService } from "../services/service.service";
import {
  createServiceSchema,
  serviceQuerySchema,
  updateServiceSchema,
} from "../validators/service.validators";

export class ServiceController {
  private service: ServiceService;

  constructor(service: ServiceService = serviceService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    // 1. From 'X-Business-ID' header
    const headerId = (req.headers["x-business-id"] ||
      req.headers["X-Business-ID"]) as string;
    if (headerId && headerId.trim().length > 0) {
      return headerId.trim();
    }

    // 2. From Query parameter
    if (req.query.businessId && typeof req.query.businessId === "string") {
      return req.query.businessId.trim();
    }

    // 3. From Request Body
    if (req.body?.businessId && typeof req.body.businessId === "string") {
      return req.body.businessId.trim();
    }

    // 4. Fallback to Authenticated User's first owned business or membership
    if (req.user?.ownedBusinesses && req.user.ownedBusinesses.length > 0) {
      return req.user.ownedBusinesses[0].id;
    }

    if (
      req.user?.businessMemberships &&
      req.user.businessMemberships.length > 0
    ) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or ensure you have selected an active business.",
      400
    );
  }

  /**
   * Create a new Service
   * POST /api/v1/services
   */
  createService = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedData = createServiceSchema.parse(req.body);

      const service = await this.service.createService(
        businessId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Service "${service.name}" created successfully`,
        service,
        201
      );
    }
  );

  /**
   * Search, filter, and paginate Services directory
   * GET /api/v1/services
   */
  getServices = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedQuery = serviceQuerySchema.parse(req.query);

      const result = await this.service.getServices(
        businessId,
        validatedQuery
      );

      return SuccessResponse(
        res,
        "Services retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * Get single Service by ID
   * GET /api/v1/services/:id
   */
  getServiceById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const serviceId = req.params.id as string;

      if (!serviceId) {
        throw new ErrorResponse("Service ID parameter is required", 400);
      }

      const service = await this.service.getServiceById(
        businessId,
        serviceId
      );

      return SuccessResponse(
        res,
        "Service details retrieved successfully",
        service,
        200
      );
    }
  );

  /**
   * Update existing Service
   * PUT/PATCH /api/v1/services/:id
   */
  updateService = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const serviceId = req.params.id as string;

      if (!serviceId) {
        throw new ErrorResponse("Service ID parameter is required", 400);
      }

      const validatedData = updateServiceSchema.parse(req.body);
      const updated = await this.service.updateService(
        businessId,
        serviceId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Service "${updated.name}" updated successfully`,
        updated,
        200
      );
    }
  );

  /**
   * Delete or archive Service
   * DELETE /api/v1/services/:id
   */
  deleteService = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const serviceId = req.params.id as string;

      if (!serviceId) {
        throw new ErrorResponse("Service ID parameter is required", 400);
      }

      const result = await this.service.deleteService(businessId, serviceId);

      return SuccessResponse(res, result.message, result, 200);
    }
  );

  /**
   * Get Service Directory Aggregate Metrics
   * GET /api/v1/services/metrics/summary
   */
  getServiceMetrics = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);

      const metrics = await this.service.getMetrics(businessId);

      return SuccessResponse(
        res,
        "Service metrics retrieved successfully",
        metrics,
        200
      );
    }
  );
}

export const serviceController = new ServiceController();
