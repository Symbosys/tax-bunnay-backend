import { ErrorResponse } from "../../../utils/response.util";
import { expenseRepository, ExpenseRepository } from "../repo/expense.repo";
import type {
  CreateExpenseInput,
  ExpenseQueryParams,
  UpdateExpenseInput,
} from "../validators/expense.validators";

export class ExpenseService {
  private repo: ExpenseRepository;

  constructor(repo: ExpenseRepository = expenseRepository) {
    this.repo = repo;
  }

  /**
   * 1. Create a new expense record
   */
  async createExpense(businessId: string, input: CreateExpenseInput) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required to record an expense", 400);
    }

    const amount = Number(input.amount);
    const gstAmount = Number(input.gstAmount ?? 0);

    if (isNaN(amount) || amount <= 0) {
      throw new ErrorResponse("Expense amount must be greater than 0", 400);
    }

    if (gstAmount > amount) {
      throw new ErrorResponse("GST amount cannot exceed the total expense amount", 400);
    }

    return this.repo.createExpense(businessId, input);
  }

  /**
   * 2. Query expenses with filters, search, and pagination
   */
  async getExpenses(businessId: string, query: ExpenseQueryParams) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }

    return this.repo.findExpenses(businessId, query);
  }

  /**
   * 3. Fetch single expense detail
   */
  async getExpenseById(businessId: string, id: string) {
    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Expense ID is required", 400);
    }

    return this.repo.findExpenseById(businessId, id.trim());
  }

  /**
   * 4. Update an existing expense
   */
  async updateExpense(businessId: string, id: string, input: UpdateExpenseInput) {
    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Expense ID is required", 400);
    }

    if (input.amount !== undefined && input.gstAmount !== undefined) {
      if (Number(input.gstAmount) > Number(input.amount)) {
        throw new ErrorResponse("GST amount cannot exceed total expense amount", 400);
      }
    }

    return this.repo.updateExpense(businessId, id.trim(), input);
  }

  /**
   * 5. Delete an expense
   */
  async deleteExpense(businessId: string, id: string) {
    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Expense ID is required", 400);
    }

    return this.repo.deleteExpense(businessId, id.trim());
  }

  /**
   * 6. Aggregated Summary & Metrics (Total Outflows, GST claimed, Net, Breakdown)
   */
  async getExpenseSummary(businessId: string, startDateStr?: string, endDateStr?: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    return this.repo.getExpenseSummary(businessId, startDate, endDate);
  }

  /**
   * 7. Supported expense categories
   */
  getCategories() {
    return this.repo.getCategories();
  }
}

export const expenseService = new ExpenseService();
