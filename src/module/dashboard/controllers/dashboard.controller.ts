import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util";
import { dashboardService, DashboardService } from "../services/dashboard.service";
import {
  dashboardQuerySchema,
  type DashboardTrendPeriod,
} from "../validators/dashboard.validators";

export class DashboardController {
  private service: DashboardService;

  constructor(service: DashboardService = dashboardService) {
    this.service = service;
  }

  /**
   * Safe extraction of active business ID
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

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * GET /api/v1/dashboard/overview
   * Returns unified full dashboard payload (KPIs, trend chart, cash/bank, inventory, recent activity, reminders)
   */
  getOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validated = dashboardQuerySchema.parse(req.query);

    const result = await this.service.getOverview(businessId, validated);
    SuccessResponse(res, "Dashboard overview retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/metrics
   * Returns 4 Financial KPI metrics cards (Today's Sales, Today's Purchases, Total Receivables, Total Payables)
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getMetrics(businessId);
    SuccessResponse(res, "Dashboard KPI metrics retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/trends
   * Returns Monthly Sales & Purchase trend curve for charts
   */
  getTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const period = (req.query.period as DashboardTrendPeriod) || "this_year";
    const result = await this.service.getTrends(businessId, period);
    SuccessResponse(res, "Sales and purchase trend retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/cash-bank
   * Returns Cash & Bank balances breakdown
   */
  getCashBank = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getCashBank(businessId);
    SuccessResponse(res, "Cash and bank balance retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/inventory-summary
   * Returns Inventory summary and stock level counts
   */
  getInventorySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getInventorySummary(businessId);
    SuccessResponse(res, "Inventory summary retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/recent-sales
   * Returns Recent 5-10 sales invoices
   */
  getRecentSales = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const result = await this.service.getRecentSales(businessId, limit);
    SuccessResponse(res, "Recent sales retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/recent-purchases
   * Returns Recent 5-10 purchase bills
   */
  getRecentPurchases = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const result = await this.service.getRecentPurchases(businessId, limit);
    SuccessResponse(res, "Recent purchases retrieved successfully", result);
  });

  /**
   * GET /api/v1/dashboard/reminders
   * Returns Upcoming reminders and actionable alerts
   */
  getReminders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getReminders(businessId);
    SuccessResponse(res, "Upcoming reminders retrieved successfully", result);
  });
}

export const dashboardController = new DashboardController();
