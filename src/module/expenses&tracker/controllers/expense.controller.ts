import type { Response } from "express";
import { prisma } from "../../../db/prisma";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util";
import { expenseService, ExpenseService } from "../services/expense.service";
import {
  createExpenseSchema,
  expenseQuerySchema,
  updateExpenseSchema,
} from "../validators/expense.validators";

export class ExpenseController {
  private service: ExpenseService;

  constructor(service: ExpenseService = expenseService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, query, body, or user session
   */
  private async extractBusinessId(req: AuthenticatedRequest): Promise<string> {
    const headerId = (req.headers["x-business-id"] || req.headers["X-Business-ID"]) as string;
    if (headerId && headerId.trim().length > 0 && !headerId.trim().startsWith("biz_")) {
      const exists = await prisma.business.findUnique({
        where: { id: headerId.trim() },
        select: { id: true },
      });
      if (exists) {
        return exists.id;
      }
    }

    if (
      req.query.businessId &&
      typeof req.query.businessId === "string" &&
      !req.query.businessId.trim().startsWith("biz_")
    ) {
      const exists = await prisma.business.findUnique({
        where: { id: req.query.businessId.trim() },
        select: { id: true },
      });
      if (exists) {
        return exists.id;
      }
    }

    if (
      req.body?.businessId &&
      typeof req.body.businessId === "string" &&
      !req.body.businessId.trim().startsWith("biz_")
    ) {
      const exists = await prisma.business.findUnique({
        where: { id: req.body.businessId.trim() },
        select: { id: true },
      });
      if (exists) {
        return exists.id;
      }
    }

    if (req.user?.ownedBusinesses && req.user.ownedBusinesses.length > 0) {
      return req.user.ownedBusinesses[0].id;
    }

    if (req.user?.businessMemberships && req.user.businessMemberships.length > 0) {
      return req.user.businessMemberships[0].businessId;
    }

    // Platform admin fallback or single-tenant fallback
    const firstBusiness = await prisma.business.findFirst({ select: { id: true } });
    if (firstBusiness) {
      return firstBusiness.id;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * 1. Record an Expense
   * POST /api/v1/expenses
   */
  createExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const validatedInput = createExpenseSchema.parse(req.body);

    const result = await this.service.createExpense(businessId, validatedInput);
    return SuccessResponse(res, "Expense recorded successfully", result, 201);
  });

  /**
   * 2. Query Expenses List
   * GET /api/v1/expenses
   */
  getExpenses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const query = expenseQuerySchema.parse(req.query);

    const result = await this.service.getExpenses(businessId, query);
    return SuccessResponse(res, "Expenses retrieved successfully", result, 200);
  });

  /**
   * 3. Get Expense Summary & Metrics
   * GET /api/v1/expenses/summary
   */
  getExpenseSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const summary = await this.service.getExpenseSummary(businessId, startDate, endDate);
    return SuccessResponse(res, "Expense summary retrieved successfully", summary, 200);
  });

  /**
   * 4. Get List of Categories with UI Icons and Colors
   * GET /api/v1/expenses/categories
   */
  getCategories = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const categories = this.service.getCategories();
    return SuccessResponse(res, "Categories retrieved successfully", categories, 200);
  });

  /**
   * 5. Get Single Expense Details
   * GET /api/v1/expenses/:id
   */
  getExpenseById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const id = req.params.id as string;

    const expense = await this.service.getExpenseById(businessId, id);
    return SuccessResponse(res, "Expense details retrieved successfully", expense, 200);
  });

  /**
   * 6. Update Expense
   * PUT/PATCH /api/v1/expenses/:id
   */
  updateExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const id = req.params.id as string;
    const validatedInput = updateExpenseSchema.parse(req.body);

    const updated = await this.service.updateExpense(businessId, id, validatedInput);
    return SuccessResponse(res, "Expense updated successfully", updated, 200);
  });

  /**
   * 7. Delete Expense
   * DELETE /api/v1/expenses/:id
   */
  deleteExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = await this.extractBusinessId(req);
    const id = req.params.id as string;

    const result = await this.service.deleteExpense(businessId, id);
    return SuccessResponse(res, "Expense deleted successfully", result, 200);
  });
}

export const expenseController = new ExpenseController();
