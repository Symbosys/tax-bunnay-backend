import { z } from "zod";
import { ExpenseCategory, PaymentMode } from "../../../generated/prisma/enums";

/**
 * Helper for nullable/optional strings
 */
const nullableString = (maxLen = 255) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val));

/**
 * Coerce numeric input (string or number) to a safe float
 */
const coerceNumber = (defaultValue = 0, minVal = 0) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .default(defaultValue)
    .transform((val) => {
      if (val === null || val === undefined || val === "") return defaultValue;
      const num = typeof val === "string" ? parseFloat(val) : Number(val);
      return isNaN(num) ? defaultValue : Math.max(minVal, num);
    });

/**
 * Maps incoming UI category string or enum to ExpenseCategory enum
 */
export const normalizeCategory = (input?: string | null): ExpenseCategory => {
  if (!input) return ExpenseCategory.OTHER;
  const clean = input.trim().toUpperCase().replace(/[\s\/-]+/g, "_");
  
  if (clean === "OFFICE_EXPENSES" || clean === "OFFICE" || clean === "OFFICE_EXPENSE") {
    return ExpenseCategory.OFFICE_EXPENSES;
  }
  if (
    clean === "REPAIRS_MAINTENANCE" ||
    clean === "REPAIRS" ||
    clean === "MAINTENANCE" ||
    clean === "REPAIRS_&_MAINTENANCE" ||
    clean === "REPAIR_MAINTENANCE"
  ) {
    return ExpenseCategory.REPAIRS_MAINTENANCE;
  }
  if (clean === "OTHER_EXPENSES" || clean === "OTHER_EXPENSE") {
    return ExpenseCategory.OTHER;
  }
  if (Object.values(ExpenseCategory).includes(clean as ExpenseCategory)) {
    return clean as ExpenseCategory;
  }
  return ExpenseCategory.OTHER;
};

/**
 * Maps incoming UI payment mode string to PaymentMode enum
 */
export const normalizePaymentMode = (input?: string | null): PaymentMode => {
  if (!input) return PaymentMode.CASH;
  const clean = input.trim().toUpperCase().replace(/[\s\/-]+/g, "_");

  if (clean === "BANK_TRANSFER" || clean === "NET_BANKING" || clean === "NEFT" || clean === "RTGS" || clean === "IMPS") {
    return PaymentMode.BANK;
  }
  if (clean === "UPI___QR" || clean === "UPI_QR" || clean === "QR" || clean === "GPAY" || clean === "PHONEPE") {
    return PaymentMode.UPI;
  }
  if (clean === "CREDIT_CARD" || clean === "DEBIT_CARD") {
    return PaymentMode.CARD;
  }
  if (Object.values(PaymentMode).includes(clean as PaymentMode)) {
    return clean as PaymentMode;
  }
  return PaymentMode.CASH;
};

/**
 * 1. Create Expense Schema
 */
export const createExpenseSchema = z.object({
  category: z
    .string()
    .trim()
    .optional()
    .default("OFFICE_EXPENSES")
    .transform((val) => normalizeCategory(val)),
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseFloat(val) : Number(val)))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Expense amount must be greater than 0",
    }),
  gstAmount: coerceNumber(0, 0),
  expenseDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return new Date();
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    }),
  vendorOrPayee: nullableString(255),
  paymentMode: z
    .string()
    .trim()
    .optional()
    .default("CASH")
    .transform((val) => normalizePaymentMode(val)),
  expenseNumber: nullableString(100),
  referenceNumber: nullableString(100),
  attachmentUrl: nullableString(1000),
  notes: nullableString(2000),
  accountId: nullableString(100),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * 2. Update Expense Schema
 */
export const updateExpenseSchema = z.object({
  category: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val !== undefined ? normalizeCategory(val) : undefined)),
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? (typeof val === "string" ? parseFloat(val) : Number(val)) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
      message: "Expense amount must be greater than 0",
    }),
  gstAmount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? (typeof val === "string" ? parseFloat(val) : Number(val)) : undefined)),
  expenseDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    }),
  vendorOrPayee: nullableString(255),
  paymentMode: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val !== undefined ? normalizePaymentMode(val) : undefined)),
  expenseNumber: nullableString(100),
  referenceNumber: nullableString(100),
  attachmentUrl: nullableString(1000),
  notes: nullableString(2000),
  accountId: nullableString(100),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * 3. Query Filter Schema
 */
export const expenseQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  minAmount: coerceNumber(0, 0).optional(),
  maxAmount: coerceNumber(0, 0).optional(),
  accountId: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1).transform((v) => Math.min(200, Math.max(1, v))),
  sortBy: z.enum(["expenseDate", "amount", "createdAt"]).optional().default("expenseDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ExpenseQueryParams = z.infer<typeof expenseQuerySchema>;
