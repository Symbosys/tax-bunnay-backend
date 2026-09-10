import { z } from "zod";
import { SalesReturnStatus } from "../../../../generated/prisma/enums";

const nullableString = (maxLen = 255) =>
  z
    .string()
    .trim()
    .max(maxLen)
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val));

const coerceNumber = (defaultValue = 0, minVal?: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .default(defaultValue)
    .transform((val) => {
      if (val === null || val === undefined || val === "") return defaultValue;
      const num = typeof val === "string" ? parseFloat(val) : Number(val);
      if (isNaN(num)) return defaultValue;
      if (minVal !== undefined) return Math.max(minVal, num);
      return num;
    });

const coerceDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((val) => {
    if (!val) return new Date();
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  });

export const salesReturnStatusSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return SalesReturnStatus.DRAFT;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "CONFIRMED") return SalesReturnStatus.CONFIRMED;
    if (normalized === "ADJUSTED") return SalesReturnStatus.ADJUSTED;
    if (normalized === "REFUNDED") return SalesReturnStatus.REFUNDED;
    if (normalized === "CANCELLED") return SalesReturnStatus.CANCELLED;
    if (normalized === "DRAFT") return SalesReturnStatus.DRAFT;
    return SalesReturnStatus.DRAFT;
  });

/**
 * Line item on a Sales Return / Credit Note
 */
export const salesReturnItemSchema = z.object({
  productId: nullableString(100),
  serviceId: nullableString(100),
  name: nullableString(255),
  productName: nullableString(255),
  hsnSac: nullableString(20),
  quantity: coerceNumber(1, 0.001),
  unit: z.string().trim().optional().default("PCS"),
  rate: coerceNumber(0, 0),
  discountPercentage: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0).optional(),
  gstRatePercent: coerceNumber(0, 0).optional(),
  gstRate: coerceNumber(0, 0).optional(),
  cgstAmount: coerceNumber(0, 0).optional(),
  sgstAmount: coerceNumber(0, 0).optional(),
  igstAmount: coerceNumber(0, 0).optional(),
  cessAmount: coerceNumber(0, 0).optional(),
  lineTotal: coerceNumber(0, 0).optional(),
  reason: nullableString(500),
});

/**
 * Payload to create a new Sales Return (Credit Note)
 */
export const createSalesReturnSchema = z.object({
  returnNumber: nullableString(100),
  returnDate: coerceDate,
  invoiceId: nullableString(100),
  originalInvoiceId: nullableString(100),
  customerId: nullableString(100),
  customerName: nullableString(255),
  customerPhone: nullableString(50),
  billingAddress: nullableString(500),
  shippingAddress: nullableString(500),
  placeOfSupply: nullableString(100),
  status: salesReturnStatusSchema,
  reason: nullableString(500),
  refundMode: nullableString(100),
  warehouseId: nullableString(100).default("main"),
  notes: nullableString(1000),
  termsConditions: nullableString(2000),
  subtotal: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  cgstAmount: coerceNumber(0, 0),
  sgstAmount: coerceNumber(0, 0),
  igstAmount: coerceNumber(0, 0),
  cessAmount: coerceNumber(0, 0),
  roundOff: coerceNumber(0),
  totalAmount: coerceNumber(0, 0).optional(),
  grandTotal: coerceNumber(0, 0).optional(),
  amountRefunded: coerceNumber(0, 0),
  items: z.array(salesReturnItemSchema).min(1, "At least one return item is required"),
});

/**
 * Payload to update an existing Sales Return
 */
export const updateSalesReturnSchema = createSalesReturnSchema.partial();

/**
 * Query schema for searching, filtering, and paginating sales returns
 */
export const salesReturnQuerySchema = z.object({
  q: z.string().trim().optional(),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  invoiceId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  page: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val as string, 10)) : 1)),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) =>
      val ? Math.min(200, Math.max(1, parseInt(val as string, 10))) : 20
    ),
});

/**
 * Status update payload
 */
export const updateSalesReturnStatusSchema = z.object({
  status: z
    .string()
    .trim()
    .transform((val) => {
      const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
      if (normalized === "CONFIRMED") return SalesReturnStatus.CONFIRMED;
      if (normalized === "ADJUSTED") return SalesReturnStatus.ADJUSTED;
      if (normalized === "REFUNDED") return SalesReturnStatus.REFUNDED;
      if (normalized === "CANCELLED") return SalesReturnStatus.CANCELLED;
      if (normalized === "DRAFT") return SalesReturnStatus.DRAFT;
      throw new Error(`Invalid sales return status: ${val}`);
    }),
});

export type SalesReturnItemInput = z.infer<typeof salesReturnItemSchema>;
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;
export type UpdateSalesReturnInput = z.infer<typeof updateSalesReturnSchema>;
export type SalesReturnQueryParams = z.infer<typeof salesReturnQuerySchema>;
export type UpdateSalesReturnStatusInput = z.infer<typeof updateSalesReturnStatusSchema>;
