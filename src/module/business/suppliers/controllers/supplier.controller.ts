import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { supplierService, SupplierService } from "../services/supplier.service";
import {
  createSupplierSchema,
  supplierQuerySchema,
  updateSupplierSchema,
} from "../validators/supplier.validators";

export class SupplierController {
  private service: SupplierService;

  constructor(service: SupplierService = supplierService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    // 1. From 'X-Business-ID' header (case-insensitive check)
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
   * Create a new Supplier
   * POST /api/v1/suppliers or POST /api/v1/business/suppliers
   */
  createSupplier = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedData = createSupplierSchema.parse(req.body);

      const supplier = await this.service.createSupplier(
        businessId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Supplier "${supplier.name}" created successfully`,
        supplier,
        201
      );
    }
  );

  /**
   * Search, filter, and paginate Supplier directory
   * GET /api/v1/suppliers or GET /api/v1/business/suppliers
   */
  getSuppliers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedQuery = supplierQuerySchema.parse(req.query);

      const result = await this.service.getSuppliers(
        businessId,
        validatedQuery
      );

      return SuccessResponse(
        res,
        "Suppliers retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * Get single Supplier profile with detailed history
   * GET /api/v1/suppliers/:id or GET /api/v1/business/suppliers/:id
   */
  getSupplierById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const supplierId = req.params.id as string;

      if (!supplierId) {
        throw new ErrorResponse("Supplier ID parameter is required", 400);
      }

      const supplier = await this.service.getSupplierById(
        businessId,
        supplierId
      );

      return SuccessResponse(
        res,
        "Supplier details retrieved successfully",
        supplier,
        200
      );
    }
  );

  /**
   * Update existing Supplier
   * PUT/PATCH /api/v1/suppliers/:id or PUT/PATCH /api/v1/business/suppliers/:id
   */
  updateSupplier = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const supplierId = req.params.id as string;

      if (!supplierId) {
        throw new ErrorResponse("Supplier ID parameter is required", 400);
      }

      const validatedData = updateSupplierSchema.parse(req.body);
      const updated = await this.service.updateSupplier(
        businessId,
        supplierId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Supplier "${updated.name}" updated successfully`,
        updated,
        200
      );
    }
  );

  /**
   * Delete or archive Supplier
   * DELETE /api/v1/suppliers/:id or DELETE /api/v1/business/suppliers/:id
   */
  deleteSupplier = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const supplierId = req.params.id as string;

      if (!supplierId) {
        throw new ErrorResponse("Supplier ID parameter is required", 400);
      }

      const result = await this.service.deleteSupplier(businessId, supplierId);

      return SuccessResponse(res, result.message, result, 200);
    }
  );

  /**
   * Get Supplier Directory Aggregate Metrics
   * GET /api/v1/suppliers/metrics/summary or GET /api/v1/business/suppliers/metrics/summary
   */
  getSupplierMetrics = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);

      const metrics = await this.service.getMetrics(businessId);

      return SuccessResponse(
        res,
        "Supplier metrics retrieved successfully",
        metrics,
        200
      );
    }
  );
}

export const supplierController = new SupplierController();
