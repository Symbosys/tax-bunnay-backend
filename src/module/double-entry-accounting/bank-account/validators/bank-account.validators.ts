import { z } from "zod";

/**
 * Valid bank account categories matching the UI screen tabs
 */
export const bankAccountCategoryEnum = z.enum([
  "current",
  "savings",
  "credit",
  "inactive",
  "all",
]);
export type BankAccountCategoryType = z.infer<typeof bankAccountCategoryEnum>;

/**
 * Valid bank account statuses
 */
export const bankAccountStatusEnum = z.enum(["Active", "Inactive", "all"]);
export type BankAccountStatusType = z.infer<typeof bankAccountStatusEnum>;

/**
 * Query schema for listing bank accounts with filters, tabs & pagination
 */
export const bankAccountQuerySchema = z.object({
  tab: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  sortBy: z
    .enum([
      "balance_desc",
      "balance_asc",
      "name_asc",
      "name_desc",
      "Balance (High to Low)",
      "Balance (Low to High)",
      "Name (A to Z)",
      "Name (Z to A)",
    ])
    .optional(),
  page: z.preprocess((val) => {
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 1 : parsed;
    }
    return val ?? 1;
  }, z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => {
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 10 : parsed;
    }
    return val ?? 10;
  }, z.number().int().min(1).max(100).default(10)),
});
export type BankAccountQueryInput = z.infer<typeof bankAccountQuerySchema>;

/**
 * Validation schema for creating a new bank account
 */
export const createBankAccountSchema = z.object({
  bankName: z.string().min(2, "Bank name must be at least 2 characters"),
  accountType: z.string().min(2, "Account type is required"),
  accountNumber: z.string().min(4, "Account number must be at least 4 digits"),
  ifsc: z.string().min(4, "IFSC code is required"),
  branch: z.string().optional().default(""),
  openingBalance: z.preprocess((val) => {
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return val ?? 0;
  }, z.number().default(0)),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  logoType: z.string().optional(),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

/**
 * Validation schema for updating an existing bank account
 */
export const updateBankAccountSchema = createBankAccountSchema.partial();
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

/**
 * Validation schema for bank account reconciliation
 */
export const reconcileBankAccountSchema = z.object({
  statementDate: z.string().optional(),
  statementBalance: z.preprocess((val) => {
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }, z.number().optional()),
  transactionIds: z.array(z.string()).optional().default([]),
});
export type ReconcileBankAccountInput = z.infer<typeof reconcileBankAccountSchema>;

/**
 * Query schema for exporting bank statements / register
 */
export const exportBankQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  tab: z.string().optional(),
  search: z.string().optional(),
});
export type ExportBankQueryInput = z.infer<typeof exportBankQuerySchema>;
