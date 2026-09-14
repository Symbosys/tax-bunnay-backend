import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  bankAccountService,
  BankAccountService,
} from "../services/bank-account.service";
import {
  bankAccountQuerySchema,
  createBankAccountSchema,
  exportBankQuerySchema,
  reconcileBankAccountSchema,
  updateBankAccountSchema,
} from "../validators/bank-account.validators";

export class BankAccountController {
  private service: BankAccountService;

  constructor(service: BankAccountService = bankAccountService) {
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

    // Fallback default tenant
    return "biz_default_retail";
  }

  /**
   * 1. Get Bank Accounts list with KPI cards, category tabs, search, pagination,
   * recent transactions and donut chart distribution
   * GET /api/v1/accounting/bank-accounts
   */
  getBankAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = bankAccountQuerySchema.parse(req.query);
    const result = await this.service.getBankAccounts(businessId, query);

    return SuccessResponse(res, "Bank accounts retrieved successfully", result, 200);
  });

  /**
   * 2. Get Bank Summary KPIs and Donut Chart Breakdown
   * GET /api/v1/accounting/bank-accounts/summary
   */
  getBankSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = bankAccountQuerySchema.parse(req.query);
    const result = await this.service.getBankAccounts(businessId, { ...query, limit: 100 });

    const summaryData = {
      totalAccounts: result.totalAccounts,
      totalBalance: result.totalBalance,
      clearedBalance: result.clearedBalance,
      unclearedBalance: result.unclearedBalance,
      balanceOverview: result.balanceOverview,
    };

    return SuccessResponse(res, "Bank summary retrieved successfully", summaryData, 200);
  });

  /**
   * 3. Get Recent Bank Transactions
   * GET /api/v1/accounting/bank-accounts/recent-transactions
   */
  getRecentTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const transactions = await this.service.getRecentTransactions(businessId, limit);

    return SuccessResponse(res, "Recent transactions retrieved successfully", transactions, 200);
  });

  /**
   * 4. Get single bank account detail by ID
   * GET /api/v1/accounting/bank-accounts/:id
   */
  getAccountDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Bank Account ID is required", 400);
    }

    const account = await this.service.getAccountDetail(businessId, id.trim());
    if (!account) {
      throw new ErrorResponse("Bank Account not found", 404);
    }

    return SuccessResponse(res, "Bank account details retrieved successfully", account, 200);
  });

  /**
   * 5. Create a new bank account
   * POST /api/v1/accounting/bank-accounts
   */
  createBankAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createBankAccountSchema.parse(req.body);
    const newAccount = await this.service.createBankAccount(businessId, input);

    return SuccessResponse(res, "Bank account created successfully", newAccount, 201);
  });

  /**
   * 6. Update an existing bank account
   * PUT /api/v1/accounting/bank-accounts/:id
   */
  updateBankAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Bank Account ID is required", 400);
    }

    const input = updateBankAccountSchema.parse(req.body);
    const updated = await this.service.updateBankAccount(businessId, id.trim(), input);

    if (!updated) {
      throw new ErrorResponse("Bank Account not found to update", 404);
    }

    return SuccessResponse(res, "Bank account updated successfully", updated, 200);
  });

  /**
   * 7. Delete a bank account
   * DELETE /api/v1/accounting/bank-accounts/:id
   */
  deleteBankAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Bank Account ID is required", 400);
    }

    const deleted = await this.service.deleteBankAccount(businessId, id.trim());
    if (!deleted) {
      throw new ErrorResponse("Bank Account not found to delete", 404);
    }

    return SuccessResponse(res, "Bank account deleted successfully", { id: id.trim() }, 200);
  });

  /**
   * 8. Toggle Active / Inactive status of a bank account
   * POST /api/v1/accounting/bank-accounts/:id/toggle-status
   */
  toggleStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Bank Account ID is required", 400);
    }

    const updated = await this.service.toggleStatus(businessId, id.trim());
    if (!updated) {
      throw new ErrorResponse("Bank Account not found", 404);
    }

    return SuccessResponse(res, `Bank account status changed to ${updated.status}`, updated, 200);
  });

  /**
   * 9. Reconcile bank account
   * POST /api/v1/accounting/bank-accounts/:id/reconcile
   */
  reconcileAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Bank Account ID is required", 400);
    }

    const input = reconcileBankAccountSchema.parse(req.body);
    const result = await this.service.reconcileAccount(businessId, id.trim(), input);

    if (!result) {
      throw new ErrorResponse("Bank Account not found for reconciliation", 404);
    }

    return SuccessResponse(res, "Bank account reconciled successfully", result, 200);
  });

  /**
   * 10. Export bank accounts to CSV
   * GET /api/v1/accounting/bank-accounts/export
   */
  exportBankAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = exportBankQuerySchema.parse(req.query);
    const exportResult = await this.service.exportBankAccounts(businessId, query);

    return SuccessResponse(res, "Bank accounts exported successfully", exportResult, 200);
  });
}

export const bankAccountController = new BankAccountController();
