import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  chartAccountService,
  ChartAccountService,
} from "../services/chart-account.service";
import {
  chartAccountQuerySchema,
  createChartAccountSchema,
  updateChartAccountSchema,
} from "../validators/chart-account.validators";

export class ChartAccountController {
  private service: ChartAccountService;

  constructor(service: ChartAccountService = chartAccountService) {
    this.service = service;
  }

  /**
   * Helper to resolve active business ID from headers, query, body, or user session
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

    // Default demo/fallback tenant if none specified
    return "biz_default_retail";
  }

  /**
   * 1. Get Chart of Accounts hierarchical tree with 4 KPI cards and category filtering
   * GET /api/v1/accounting/chart-of-accounts
   */
  getChartOfAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = chartAccountQuerySchema.parse(req.query);
    const result = await this.service.getChartOfAccounts(businessId, query);

    return SuccessResponse(res, "Chart of accounts retrieved successfully", result, 200);
  });

  /**
   * 2. Get flat accounts list for dropdowns
   * GET /api/v1/accounting/chart-of-accounts/flat
   */
  getFlatAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getFlatAccounts(businessId);

    return SuccessResponse(res, "Flat accounts list retrieved successfully", result, 200);
  });

  /**
   * 3. Get list of parent groups for Add Account modal dropdown
   * GET /api/v1/accounting/chart-of-accounts/groups
   */
  getAccountGroups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getAccountGroups(businessId);

    return SuccessResponse(res, "Parent account groups retrieved successfully", result, 200);
  });

  /**
   * 4. Get single account detail by ID or Code
   * GET /api/v1/accounting/chart-of-accounts/:id
   */
  getAccountDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Account ID parameter is required", 400);
    }

    const result = await this.service.getAccountDetail(businessId, id.trim());
    return SuccessResponse(res, "Account details retrieved successfully", result, 200);
  });

  /**
   * 5. Create a new Chart of Account
   * POST /api/v1/accounting/chart-of-accounts
   */
  createAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createChartAccountSchema.parse(req.body);
    const result = await this.service.createAccount(businessId, input);

    return SuccessResponse(res, "Chart of account created successfully", result, 201);
  });

  /**
   * 6. Update an existing Account
   * PUT /api/v1/accounting/chart-of-accounts/:id
   */
  updateAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Account ID parameter is required", 400);
    }

    const input = updateChartAccountSchema.parse(req.body);
    const result = await this.service.updateAccount(businessId, id.trim(), input);

    return SuccessResponse(res, "Chart of account updated successfully", result, 200);
  });

  /**
   * 7. Delete an Account
   * DELETE /api/v1/accounting/chart-of-accounts/:id
   */
  deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Account ID parameter is required", 400);
    }

    const result = await this.service.deleteAccount(businessId, id.trim());
    return SuccessResponse(res, result.message, result, 200);
  });
}

export const chartAccountController = new ChartAccountController();
