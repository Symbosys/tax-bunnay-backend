import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util";
import { GstService, gstService } from "../services/gst.service";
import {
  fileReturnSchema,
  gstinLookupSchema,
  gstReturnsQuerySchema,
  recordGstPaymentSchema,
  updateGstProfileSchema,
} from "../validators/gst.validators";

export class GstController {
  private service: GstService;

  constructor(service: GstService = gstService) {
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
   * Get GST Profile
   * GET /api/v1/gst/profile
   */
  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const profile = await this.service.getGstProfile(businessId);
    return SuccessResponse(res, "GST Profile retrieved successfully", profile);
  });

  /**
   * Update GST Profile
   * PUT /api/v1/gst/profile
   */
  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = updateGstProfileSchema.parse(req.body);
    const updated = await this.service.updateGstProfile(businessId, validatedData);
    return SuccessResponse(res, "GST Profile updated successfully", updated);
  });

  /**
   * Get 5 KPI Metrics
   * GET /api/v1/gst/metrics
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getKpiMetrics(businessId);
    return SuccessResponse(res, "GST KPI metrics retrieved successfully", metrics);
  });

  /**
   * Get GST Returns List
   * GET /api/v1/gst/returns
   */
  getReturns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = gstReturnsQuerySchema.parse(req.query);
    const returns = await this.service.getReturnsList(businessId, query);
    return SuccessResponse(res, "GST Returns retrieved successfully", returns);
  });

  /**
   * Get Single Return by ID
   * GET /api/v1/gst/returns/:id
   */
  getReturnById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = String(req.params.id || "");
    const returnRecord = await this.service.getReturnById(businessId, id);
    return SuccessResponse(res, "Return record details retrieved successfully", returnRecord);
  });

  /**
   * Submit and File a GST Return
   * POST /api/v1/gst/returns/file
   */
  fileReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = fileReturnSchema.parse(req.body);
    const result = await this.service.fileReturn(businessId, validatedData);
    return SuccessResponse(res, result.message, result, 201);
  });

  /**
   * Get Tax Liability Summary Donut data
   * GET /api/v1/gst/liability-summary
   */
  getLiabilitySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const summary = await this.service.getLiabilitySummary(businessId);
    return SuccessResponse(res, "Tax liability summary retrieved successfully", summary);
  });

  /**
   * Verify and Lookup any 15-digit GSTIN
   * POST /api/v1/gst/lookup or GET /api/v1/gst/lookup/:gstin
   */
  lookupGstin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const gstinParam = req.params.gstin || req.query.gstin || req.body?.gstin;
    const { gstin } = gstinLookupSchema.parse({ gstin: gstinParam });
    const result = await this.service.lookupGstin(gstin);
    return SuccessResponse(res, "GSTIN verified successfully", result);
  });

  /**
   * Sync data from GSTN Portal
   * POST /api/v1/gst/sync
   */
  syncGstPortal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const syncResult = await this.service.syncFromGstPortal(businessId);
    return SuccessResponse(res, syncResult.message, syncResult);
  });

  /**
   * Export GSTR-1 JSON Payload
   * GET /api/v1/gst/export/json/gstr1/:period
   */
  exportGstr1Json = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const period = String(req.params.period || "May 2026");
    const payload = await this.service.generateGstr1Payload(businessId, period);

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="GSTR1_${payload.gstin}_${payload.fp}.json"`
    );
    return res.status(200).json(payload);
  });

  /**
   * Record GST Challan Payment
   * POST /api/v1/gst/payments
   */
  recordPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = recordGstPaymentSchema.parse(req.body);
    const result = await this.service.recordPayment(businessId, validatedData);
    return SuccessResponse(res, result.message, result, 201);
  });
}

export const gstController = new GstController();
