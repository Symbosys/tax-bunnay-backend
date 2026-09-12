import { prisma } from "../../../db/prisma";
import { ExpenseCategory, PaymentMode } from "../../../generated/prisma/enums";
import { ErrorResponse } from "../../../utils/response.util";
import type {
  CreateExpenseInput,
  ExpenseQueryParams,
  UpdateExpenseInput,
} from "../validators/expense.validators";

export class ExpenseRepository {
  /**
   * Helper to format date as YYYYMMDD
   */
  private formatDatePrefix(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * Generate sequential voucher number e.g. EXP-20260912-0001
   */
  async generateNextExpenseNumber(businessId: string, date: Date = new Date()): Promise<string> {
    const prefix = `EXP-${this.formatDatePrefix(date)}-`;
    const lastRecord = await prisma.expense.findFirst({
      where: {
        businessId,
        expenseNumber: { startsWith: prefix },
      },
      orderBy: { expenseNumber: "desc" },
      select: { expenseNumber: true },
    });

    let nextSeq = 1;
    if (lastRecord?.expenseNumber) {
      const parts = lastRecord.expenseNumber.split("-");
      const lastSeqStr = parts[parts.length - 1];
      if (lastSeqStr) {
        const parsed = parseInt(lastSeqStr, 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * 1. Create Expense
   */
  async createExpense(businessId: string, input: CreateExpenseInput) {
    const expenseDate = input.expenseDate ?? new Date();
    const expenseNumber =
      input.expenseNumber && input.expenseNumber.trim().length > 0
        ? input.expenseNumber.trim()
        : await this.generateNextExpenseNumber(businessId, expenseDate);

    const amount = Number(input.amount);
    const gstAmount = Number(input.gstAmount ?? 0);
    const taxableAmount = Math.max(0, amount - gstAmount);

    return prisma.expense.create({
      data: {
        businessId,
        category: input.category,
        expenseDate,
        vendorOrPayee: input.vendorOrPayee || null,
        expenseNumber,
        referenceNumber: input.referenceNumber || null,
        amount,
        gstAmount,
        taxableAmount,
        paymentMode: input.paymentMode,
        attachmentUrl: input.attachmentUrl || null,
        notes: input.notes || null,
        accountId: input.accountId || null,
      },
      include: {
        account: {
          select: { id: true, name: true, accountType: true },
        },
      },
    });
  }

  /**
   * 2. Find paginated expenses with dynamic filtering
   */
  async findExpenses(businessId: string, query: ExpenseQueryParams) {
    const where: any = { businessId };

    // Search filter across vendor, notes, expenseNumber, referenceNumber
    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { vendorOrPayee: { contains: s, mode: "insensitive" } },
        { notes: { contains: s, mode: "insensitive" } },
        { expenseNumber: { contains: s, mode: "insensitive" } },
        { referenceNumber: { contains: s, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (query.category && query.category.trim().length > 0 && query.category.toUpperCase() !== "ALL") {
      where.category = query.category.toUpperCase() as ExpenseCategory;
    }

    // Payment mode filter
    if (query.paymentMode && query.paymentMode.trim().length > 0 && query.paymentMode.toUpperCase() !== "ALL") {
      where.paymentMode = query.paymentMode.toUpperCase() as PaymentMode;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    // Amount range filter
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {};
      if (query.minAmount !== undefined) {
        where.amount.gte = query.minAmount;
      }
      if (query.maxAmount !== undefined) {
        where.amount.lte = query.maxAmount;
      }
    }

    // Account filter
    if (query.accountId && query.accountId.trim().length > 0) {
      where.accountId = query.accountId.trim();
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [total, expenses, aggregate] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || "expenseDate"]: query.sortOrder || "desc" },
        include: {
          account: {
            select: { id: true, name: true, accountType: true },
          },
        },
      }),
      prisma.expense.aggregate({
        where,
        _sum: {
          amount: true,
          gstAmount: true,
          taxableAmount: true,
        },
      }),
    ]);

    const totalAmount = Number(aggregate._sum.amount || 0);
    const totalGst = Number(aggregate._sum.gstAmount || 0);
    const netOutflow = Math.max(0, totalAmount - totalGst);

    return {
      expenses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalAmount,
        totalGst,
        netOutflow,
      },
    };
  }

  /**
   * 3. Find single expense by ID
   */
  async findExpenseById(businessId: string, id: string) {
    const expense = await prisma.expense.findFirst({
      where: { id, businessId },
      include: {
        account: {
          select: { id: true, name: true, accountType: true },
        },
      },
    });

    if (!expense) {
      throw new ErrorResponse("Expense entry not found", 404);
    }
    return expense;
  }

  /**
   * 4. Update Expense
   */
  async updateExpense(businessId: string, id: string, input: UpdateExpenseInput) {
    const existing = await prisma.expense.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new ErrorResponse("Expense entry not found", 404);
    }

    const updateData: any = {};
    if (input.category !== undefined) updateData.category = input.category;
    if (input.vendorOrPayee !== undefined) updateData.vendorOrPayee = input.vendorOrPayee;
    if (input.paymentMode !== undefined) updateData.paymentMode = input.paymentMode;
    if (input.expenseDate !== undefined) updateData.expenseDate = input.expenseDate;
    if (input.expenseNumber !== undefined) updateData.expenseNumber = input.expenseNumber;
    if (input.referenceNumber !== undefined) updateData.referenceNumber = input.referenceNumber;
    if (input.attachmentUrl !== undefined) updateData.attachmentUrl = input.attachmentUrl;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.accountId !== undefined) updateData.accountId = input.accountId;

    const currentAmount = input.amount !== undefined ? Number(input.amount) : Number(existing.amount);
    const currentGst = input.gstAmount !== undefined ? Number(input.gstAmount) : Number(existing.gstAmount);

    if (input.amount !== undefined) updateData.amount = currentAmount;
    if (input.gstAmount !== undefined) updateData.gstAmount = currentGst;
    if (input.amount !== undefined || input.gstAmount !== undefined) {
      updateData.taxableAmount = Math.max(0, currentAmount - currentGst);
    }

    return prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true, accountType: true },
        },
      },
    });
  }

  /**
   * 5. Delete Expense
   */
  async deleteExpense(businessId: string, id: string) {
    const existing = await prisma.expense.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new ErrorResponse("Expense entry not found", 404);
    }

    await prisma.expense.delete({
      where: { id },
    });

    return { id, message: "Expense record deleted successfully" };
  }

  /**
   * 6. Aggregated Summary & Metrics (Matching UI stat cards & breakdown)
   */
  async getExpenseSummary(businessId: string, startDate?: Date, endDate?: Date) {
    const where: any = { businessId };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = startDate;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    const [overall, categoryGroups, paymentModeGroups, recent] = await Promise.all([
      // Overall totals
      prisma.expense.aggregate({
        where,
        _sum: { amount: true, gstAmount: true, taxableAmount: true },
        _count: { id: true },
      }),
      // Group by Category
      prisma.expense.groupBy({
        by: ["category"],
        where,
        _sum: { amount: true, gstAmount: true },
        _count: { id: true },
      }),
      // Group by Payment Mode
      prisma.expense.groupBy({
        by: ["paymentMode"],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Top 5 recent expenses
      prisma.expense.findMany({
        where,
        take: 5,
        orderBy: { expenseDate: "desc" },
        select: {
          id: true,
          expenseNumber: true,
          vendorOrPayee: true,
          category: true,
          amount: true,
          gstAmount: true,
          paymentMode: true,
          expenseDate: true,
        },
      }),
    ]);

    const totalAmount = Number(overall._sum.amount || 0);
    const totalGst = Number(overall._sum.gstAmount || 0);
    const netOutflow = Math.max(0, totalAmount - totalGst);
    const totalCount = overall._count.id;

    // Map category breakdown with percentages
    const categoryBreakdown = categoryGroups.map((g) => {
      const catAmount = Number(g._sum.amount || 0);
      return {
        category: g.category,
        count: g._count.id,
        totalAmount: catAmount,
        totalGst: Number(g._sum.gstAmount || 0),
        percentage: totalAmount > 0 ? Number(((catAmount / totalAmount) * 100).toFixed(1)) : 0,
      };
    });

    // Map payment mode breakdown
    const paymentModeBreakdown = paymentModeGroups.map((g) => {
      const modeAmount = Number(g._sum.amount || 0);
      return {
        paymentMode: g.paymentMode,
        count: g._count.id,
        totalAmount: modeAmount,
        percentage: totalAmount > 0 ? Number(((modeAmount / totalAmount) * 100).toFixed(1)) : 0,
      };
    });

    return {
      totalRecordedExpenses: totalAmount,
      totalGstClaimed: totalGst,
      netCashOutflow: netOutflow,
      totalExpenseCount: totalCount,
      categoryBreakdown,
      paymentModeBreakdown,
      recentExpenses: recent,
    };
  }

  /**
   * 7. Metadata list of supported categories
   */
  getCategories() {
    return [
      { code: "RENT", label: "Rent", icon: "apartment_rounded", color: "#D97706" },
      { code: "ELECTRICITY", label: "Electricity", icon: "bolt_rounded", color: "#EAB308" },
      { code: "INTERNET", label: "Internet", icon: "wifi_rounded", color: "#0284C7" },
      { code: "SALARY", label: "Salary", icon: "badge_rounded", color: "#059669" },
      { code: "TRAVEL", label: "Travel", icon: "directions_car_rounded", color: "#6366F1" },
      { code: "ADVERTISEMENT", label: "Advertisement", icon: "campaign_rounded", color: "#EC4899" },
      { code: "OFFICE_EXPENSES", label: "Office Expenses", icon: "business_center_rounded", color: "#8B5CF6" },
      { code: "REPAIRS_MAINTENANCE", label: "Repairs & Maintenance", icon: "build_rounded", color: "#F97316" },
      { code: "OTHER", label: "Other Expenses", icon: "receipt_long_rounded", color: "#64748B" },
    ];
  }
}

export const expenseRepository = new ExpenseRepository();
