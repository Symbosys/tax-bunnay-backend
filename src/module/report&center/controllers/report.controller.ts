import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util";
import { reportService, ReportService } from "../services/report.service";
import {
  createReportExportSchema,
  createSavedReportSchema,
  gstSummaryQuerySchema,
  purchaseRegisterQuerySchema,
  salesRegisterQuerySchema,
  stockValuationQuerySchema,
} from "../validators/report.validators";

export class ReportController {
  private service: ReportService;

  constructor(service: ReportService = reportService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, query, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    const headerId = (req.headers["x-business-id"] || req.headers["X-Business-ID"]) as string;
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

    if (req.user?.businessMemberships && req.user.businessMemberships.length > 0) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * 1. Get Sales Register Report
   * GET /api/v1/reports/sales-register
   */
  getSalesRegister = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = salesRegisterQuerySchema.parse(req.query);

    const result = await this.service.getSalesRegister(businessId, query);
    return SuccessResponse(res, "Sales register log retrieved successfully", result, 200);
  });

  /**
   * 2. Get Purchase Register Report
   * GET /api/v1/reports/purchase-register
   */
  getPurchaseRegister = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = purchaseRegisterQuerySchema.parse(req.query);

    const result = await this.service.getPurchaseRegister(businessId, query);
    return SuccessResponse(res, "Purchase register log retrieved successfully", result, 200);
  });

  /**
   * 3. Get GST Liability Summary
   * GET /api/v1/reports/gst-summary
   */
  getGstSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = gstSummaryQuerySchema.parse(req.query);

    const result = await this.service.getGstSummary(businessId, query);
    return SuccessResponse(res, "GST liability summary retrieved successfully", result, 200);
  });

  /**
   * 4. Get Stock Valuation & Inventory Asset Report
   * GET /api/v1/reports/stock-valuation
   */
  getStockValuation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = stockValuationQuerySchema.parse(req.query);

    const result = await this.service.getStockValuation(businessId, query);
    return SuccessResponse(res, "Stock asset valuation retrieved successfully", result, 200);
  });

  /**
   * 5. Get Available Reports Catalog
   * GET /api/v1/reports/catalog
   */
  getReportsCatalog = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const catalog = this.service.getReportsCatalog();
    return SuccessResponse(res, "Reports catalog retrieved successfully", catalog, 200);
  });

  /**
   * 6. Trigger Report Export (Excel / PDF / CSV)
   * POST /api/v1/reports/export
   */
  exportReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedInput = createReportExportSchema.parse(req.body);

    const result = await this.service.exportReport(businessId, req.user?.id, validatedInput);

    // If client requested raw file download via query `download=true`
    if (req.query.download === "true") {
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.status(200).send(result.csvContent);
    }

    return SuccessResponse(res, "Report exported successfully", result, 200);
  });

  /**
   * 7. Export History
   * GET /api/v1/reports/exports
   */
  getExportHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const history = await this.service.getReportExports(businessId);
    return SuccessResponse(res, "Export history retrieved successfully", history, 200);
  });

  /**
   * 8. Saved Reports
   * GET /api/v1/reports/saved
   * POST /api/v1/reports/saved
   * DELETE /api/v1/reports/saved/:id
   */
  getSavedReports = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const saved = await this.service.getSavedReports(businessId);
    return SuccessResponse(res, "Saved reports retrieved successfully", saved, 200);
  });

  createSavedReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createSavedReportSchema.parse(req.body);

    const result = await this.service.createSavedReport(businessId, input);
    return SuccessResponse(res, "Saved report created successfully", result, 201);
  });

  deleteSavedReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const paramId = req.params.id;
    const id = Array.isArray(paramId) ? paramId[0] : paramId;

    if (!id || typeof id !== "string") {
      throw new ErrorResponse("Report ID is required", 400);
    }

    await this.service.deleteSavedReport(businessId, id);
    return SuccessResponse(res, "Saved report deleted successfully", null, 200);
  });
}

export const reportController = new ReportController();
