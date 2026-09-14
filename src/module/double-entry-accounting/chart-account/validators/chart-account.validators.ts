import { z } from "zod";

/**
 * Account category types matching standard double-entry accounting
 */
export const accountCategoryEnum = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export type AccountCategoryType = z.infer<typeof accountCategoryEnum>;

/**
 * 1. Query / Filter schema for Chart of Accounts
 */
export const chartAccountQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional().default("All Accounts"), // 'All Accounts' | 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses'
  showZeroBalances: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(true)
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() !== "false";
      return true;
    }),
  sortBy: z.string().trim().optional().default("Code (Ascending)"), // 'Code (Ascending)' | 'Code (Descending)' | 'Name (A-Z)' | 'Balance (High to Low)' | 'Balance (Low to High)'
});

export type ChartAccountQueryParams = z.infer<typeof chartAccountQuerySchema>;

/**
 * 2. Create Chart of Account Schema
 */
export const createChartAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required"),
  code: z.string().trim().min(1, "Account code is required"),
  type: accountCategoryEnum,
  parentCode: z.string().trim().optional().nullable(),
  openingBalance: z
    .union([z.number(), z.string()])
    .optional()
    .default(0)
    .transform((val) => Number(val) || 0),
  description: z.string().trim().optional().default(""),
  isGroup: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .transform((val) => val === true || val === "true"),
});

export type CreateChartAccountInput = z.infer<typeof createChartAccountSchema>;

/**
 * 3. Update Chart of Account Schema
 */
export const updateChartAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name cannot be empty").optional(),
  code: z.string().trim().min(1, "Account code cannot be empty").optional(),
  type: accountCategoryEnum.optional(),
  parentCode: z.string().trim().optional().nullable(),
  openingBalance: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? Number(val) || 0 : undefined)),
  description: z.string().trim().optional(),
  isGroup: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? val === true || val === "true" : undefined)),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => (val !== undefined ? val === true || val === "true" : undefined)),
});

export type UpdateChartAccountInput = z.infer<typeof updateChartAccountSchema>;
