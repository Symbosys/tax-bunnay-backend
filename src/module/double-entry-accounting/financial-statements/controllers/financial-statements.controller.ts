import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { SuccessResponse } from "../../../../utils/response.util";
import {
  financialStatementsService,
  FinancialStatementsService,
} from "../services/financial-statements.service";
import {
  customReportSchema,
  exportStatementQuerySchema,
  financialStatementQuerySchema,
  saveLayoutSchema,
  scheduleReportSchema,
} from "../validators/financial-statements.validators";

export class FinancialStatementsController {
  private service: FinancialStatementsService;

  constructor(service: FinancialStatementsService = financialStatementsService) {
    this.service = service;
  }

  /**
   * Helper to resolve active business ID from headers, query, body, or session
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

    // Fallback default tenant
    return "biz_default_retail";
  }

  /**
   * 1. Get Financial Statement (P&L, Balance Sheet, Cash Flow, or Equity Changes)
   * GET /api/v1/accounting/financial-statements
   */
  getFinancialStatement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = financialStatementQuerySchema.parse(req.query);
    const statement = await this.service.getFinancialStatement(businessId, query);

    return SuccessResponse(res, "Financial statement retrieved successfully", statement, 200);
  });

  /**
   * 2. Get Financial Summary KPIs and Donut Breakdown
   * GET /api/v1/accounting/financial-statements/summary
   */
  getFinancialSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = financialStatementQuerySchema.parse(req.query);
    const summary = await this.service.getFinancialSummary(businessId, query);

    return SuccessResponse(res, "Financial summary retrieved successfully", summary, 200);
  });

  /**
   * 3. Get Profit Trend Points for Chart
   * GET /api/v1/accounting/financial-statements/trend
   */
  getProfitTrend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = financialStatementQuerySchema.parse(req.query);
    const trend = await this.service.getProfitTrend(businessId, query);

    return SuccessResponse(res, "Profit trend retrieved successfully", trend, 200);
  });

  /**
   * 4. Get available report types cards metadata
   * GET /api/v1/accounting/financial-statements/report-types
   */
  getAvailableReportTypes = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const reportTypes = this.service.getAvailableReportTypes();
    return SuccessResponse(res, "Report types retrieved successfully", reportTypes, 200);
  });

  /**
   * 5. Create custom report
   * POST /api/v1/accounting/financial-statements/custom-report
   */
  createCustomReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = customReportSchema.parse(req.body);
    const report = await this.service.createCustomReport(businessId, input);

    return SuccessResponse(res, "Custom report created successfully", report, 201);
  });

  /**
   * 6. Schedule report
   * POST /api/v1/accounting/financial-statements/schedule
   */
  scheduleReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = scheduleReportSchema.parse(req.body);
    const schedule = await this.service.scheduleReport(businessId, input);

    return SuccessResponse(res, "Report scheduled successfully", schedule, 201);
  });

  /**
   * 7. Save layout preset
   * POST /api/v1/accounting/financial-statements/save-layout
   */
  saveLayout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = saveLayoutSchema.parse(req.body);
    const layout = await this.service.saveLayout(businessId, input);

    return SuccessResponse(res, "Report layout saved successfully", layout, 200);
  });

  /**
   * 8. Export statement as CSV or JSON
   * GET /api/v1/accounting/financial-statements/export
   */
  exportStatement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = exportStatementQuerySchema.parse(req.query);
    const exportData = await this.service.exportStatement(businessId, query);

    return SuccessResponse(res, "Financial statement exported successfully", exportData, 200);
  });
}

export const financialStatementsController = new FinancialStatementsController();
