import { z } from "zod";

/**
 * Normalization helper for financial report types
 */
export const normalizeReportType = (
  raw?: string | null
): "profitAndLoss" | "balanceSheet" | "cashFlow" | "equityChanges" => {
  if (!raw) return "profitAndLoss";
  const val = raw.toLowerCase().trim();

  if (
    val === "pnl" ||
    val === "profitandloss" ||
    val === "profit-and-loss" ||
    val.includes("profit") ||
    val.includes("income")
  ) {
    return "profitAndLoss";
  }

  if (
    val === "bs" ||
    val === "balancesheet" ||
    val === "balance-sheet" ||
    val.includes("balance")
  ) {
    return "balanceSheet";
  }

  if (
    val === "cf" ||
    val === "cashflow" ||
    val === "cash-flow" ||
    val.includes("cash")
  ) {
    return "cashFlow";
  }

  if (
    val === "eq" ||
    val === "equitychanges" ||
    val === "equity-changes" ||
    val.includes("equity")
  ) {
    return "equityChanges";
  }

  return "profitAndLoss";
};

export const statementTypeSchema = z
  .string()
  .optional()
  .transform((val) => normalizeReportType(val));

export const compareWithSchema = z
  .enum(["Previous Period", "Previous Year", "Custom Period", "None"])
  .optional()
  .default("Previous Period");

export const trendPeriodSchema = z
  .enum(["Last 6 Months", "Last 12 Months", "This Year"])
  .optional()
  .default("Last 6 Months");

/**
 * Query schema for fetching financial statements
 */
export const financialStatementQuerySchema = z.object({
  reportType: z.string().optional().default("profitAndLoss"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dateRangeLabel: z.string().optional().default("01 Apr 2026 – 31 May 2026"),
  compareWith: z.string().optional().default("Previous Period"),
  trendPeriod: z.string().optional().default("Last 6 Months"),
  businessId: z.string().optional(),
});

export type FinancialStatementQueryInput = z.infer<typeof financialStatementQuerySchema>;

/**
 * Schema for custom report configuration
 */
export const customReportSchema = z.object({
  reportName: z.string().min(1, "Report name is required"),
  reportType: z.string().optional().default("profitAndLoss"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sections: z.array(z.string()).optional().default([]),
  businessId: z.string().optional(),
});

export type CustomReportInput = z.infer<typeof customReportSchema>;

/**
 * Schema for report scheduling
 */
export const scheduleReportSchema = z.object({
  reportType: z.string().optional().default("profitAndLoss"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("monthly"),
  recipients: z.array(z.string().email("Invalid recipient email")).min(1, "At least one recipient is required"),
  format: z.enum(["pdf", "excel", "csv"]).default("pdf"),
  businessId: z.string().optional(),
});

export type ScheduleReportInput = z.infer<typeof scheduleReportSchema>;

/**
 * Schema for saving custom layout / presets
 */
export const saveLayoutSchema = z.object({
  reportType: z.string().optional().default("profitAndLoss"),
  layoutName: z.string().min(1, "Layout name is required"),
  compareWith: z.string().optional().default("Previous Period"),
  trendPeriod: z.string().optional().default("Last 6 Months"),
  visibleSections: z.array(z.string()).optional().default([]),
  businessId: z.string().optional(),
});

export type SaveLayoutInput = z.infer<typeof saveLayoutSchema>;

/**
 * Schema for exporting statement
 */
export const exportStatementQuerySchema = z.object({
  format: z.enum(["csv", "excel", "json", "pdf"]).optional().default("csv"),
  reportType: z.string().optional().default("profitAndLoss"),
  dateRangeLabel: z.string().optional().default("01 Apr 2026 – 31 May 2026"),
  businessId: z.string().optional(),
});

export type ExportStatementQueryInput = z.infer<typeof exportStatementQuerySchema>;
