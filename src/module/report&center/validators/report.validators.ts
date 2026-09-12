import { z } from "zod";

/**
 * Safe number coercion helper
 */
const coerceNumber = (defaultValue = 1, minVal = 1) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .default(defaultValue)
    .transform((val) => {
      if (val === null || val === undefined || val === "") return defaultValue;
      const num = typeof val === "string" ? parseInt(val, 10) : Number(val);
      return isNaN(num) ? defaultValue : Math.max(minVal, num);
    });

/**
 * Safe date parsing helper
 */
const parseDate = () =>
  z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    });

/**
 * Base Date Range Query Schema
 */
export const dateRangeQuerySchema = z.object({
  startDate: parseDate(),
  endDate: parseDate(),
  warehouseId: z.string().trim().optional().default("all"),
  search: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1),
});

export type DateRangeQueryParams = z.infer<typeof dateRangeQuerySchema>;

/**
 * 1. Sales Register Query Schema
 */
export const salesRegisterQuerySchema = z.object({
  startDate: parseDate(),
  endDate: parseDate(),
  warehouseId: z.string().trim().optional().default("all"),
  customerId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["invoiceDate", "invoiceNumber", "grandTotal", "createdAt"]).optional().default("invoiceDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1),
});

export type SalesRegisterQueryParams = z.infer<typeof salesRegisterQuerySchema>;

/**
 * 2. Purchase Register Query Schema
 */
export const purchaseRegisterQuerySchema = z.object({
  startDate: parseDate(),
  endDate: parseDate(),
  warehouseId: z.string().trim().optional().default("all"),
  supplierId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["purchaseDate", "purchaseNumber", "totalAmount", "createdAt"]).optional().default("purchaseDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1),
});

export type PurchaseRegisterQueryParams = z.infer<typeof purchaseRegisterQuerySchema>;

/**
 * 3. GST Summary Query Schema
 */
export const gstSummaryQuerySchema = z.object({
  startDate: parseDate(),
  endDate: parseDate(),
});

export type GstSummaryQueryParams = z.infer<typeof gstSummaryQuerySchema>;

/**
 * 4. Stock Valuation Query Schema
 */
export const stockValuationQuerySchema = z.object({
  warehouseId: z.string().trim().optional().default("all"),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(100, 1),
});

export type StockValuationQueryParams = z.infer<typeof stockValuationQuerySchema>;

/**
 * 5. Create Report Export Schema
 */
export const createReportExportSchema = z.object({
  reportType: z.enum([
    "SALES_REGISTER",
    "PURCHASE_REGISTER",
    "GST_SUMMARY",
    "STOCK_VALUATION",
    "CUSTOM",
  ]),
  reportName: z.string().trim().optional().default("Business Report"),
  format: z.enum(["EXCEL", "PDF", "CSV"]).default("EXCEL"),
  startDate: parseDate(),
  endDate: parseDate(),
  warehouseId: z.string().trim().optional().default("all"),
  filters: z.record(z.string(), z.any()).optional().default({}),
});

export type CreateReportExportInput = z.infer<typeof createReportExportSchema>;

/**
 * 6. Create Saved Report Configuration Schema
 */
export const createSavedReportSchema = z.object({
  name: z.string().trim().min(1, "Report name is required").max(255),
  description: z.string().trim().max(1000).optional(),
  reportType: z.enum([
    "SALES_REGISTER",
    "PURCHASE_REGISTER",
    "GST_SUMMARY",
    "STOCK_VALUATION",
    "CUSTOM",
  ]),
  filters: z.record(z.string(), z.any()).optional().default({}),
  isFavorite: z.boolean().optional().default(false),
  isScheduled: z.boolean().optional().default(false),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

export type CreateSavedReportInput = z.infer<typeof createSavedReportSchema>;
