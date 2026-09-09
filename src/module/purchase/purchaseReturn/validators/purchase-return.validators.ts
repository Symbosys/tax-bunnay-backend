import { z } from "zod";
import { PurchaseReturnStatus } from "../../../../generated/prisma/enums";

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

const purchaseReturnStatusSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return PurchaseReturnStatus.DRAFT;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "CONFIRMED") return PurchaseReturnStatus.CONFIRMED;
    if (normalized === "ADJUSTED") return PurchaseReturnStatus.ADJUSTED;
    if (normalized === "REFUNDED") return PurchaseReturnStatus.REFUNDED;
    if (normalized === "CANCELLED" || normalized === "CANCELED") {
      return PurchaseReturnStatus.CANCELLED;
    }
    return PurchaseReturnStatus.DRAFT;
  });

/**
 * Line item on a purchase return — matches Record Purchase Return UI.
 */
export const purchaseReturnItemSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  productName: nullableString(255),
  name: nullableString(255),
  hsnCode: nullableString(20),
  unit: z.string().trim().optional().default("PCS"),
  quantity: coerceNumber(1, 0.001),
  quantityReturned: coerceNumber(0, 0),
  rate: coerceNumber(0, 0),
  unitPrice: coerceNumber(0, 0),
  gstRate: coerceNumber(0, 0),
  gstRatePercent: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  gstAmount: coerceNumber(0, 0),
  taxAmount: coerceNumber(0, 0),
  lineTotal: coerceNumber(0, 0),
  totalAmount: coerceNumber(0, 0),
  returnReason: nullableString(500),
});

export const createPurchaseReturnSchema = z.object({
  purchaseId: z.string().trim().min(1, "Original purchase bill is required"),
  debitNoteNumber: nullableString(50),
  noteNumber: nullableString(50),
  returnDate: coerceDate,
  reason: z
    .string({ message: "Return reason is required" })
    .trim()
    .min(1, "Return reason is required")
    .max(2000),
  returnReason: nullableString(2000),
  notes: nullableString(2000),
  status: purchaseReturnStatusSchema,
  amountAdjusted: coerceNumber(0, 0),
  items: z
    .array(purchaseReturnItemSchema)
    .min(1, "Please add at least one product to return"),
});

export const updatePurchaseReturnSchema = z.object({
  debitNoteNumber: nullableString(50),
  noteNumber: nullableString(50),
  returnDate: coerceDate.optional(),
  reason: z.string().trim().min(1).max(2000).optional(),
  returnReason: nullableString(2000),
  notes: nullableString(2000),
  status: purchaseReturnStatusSchema.optional(),
  amountAdjusted: coerceNumber(0, 0).optional(),
  items: z.array(purchaseReturnItemSchema).min(1).optional(),
});

export const purchaseReturnQuerySchema = z.object({
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  purchaseId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(20, 1),
});

export const eligiblePurchaseQuerySchema = z.object({
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(20, 1),
});

export const updatePurchaseReturnStatusSchema = z.object({
  status: z
    .string()
    .trim()
    .min(1, "Status is required")
    .transform((val) => {
      const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
      if (normalized === "CONFIRMED") return PurchaseReturnStatus.CONFIRMED;
      if (normalized === "ADJUSTED") return PurchaseReturnStatus.ADJUSTED;
      if (normalized === "REFUNDED") return PurchaseReturnStatus.REFUNDED;
      if (normalized === "CANCELLED" || normalized === "CANCELED") {
        return PurchaseReturnStatus.CANCELLED;
      }
      if (normalized === "DRAFT") return PurchaseReturnStatus.DRAFT;
      throw new Error("Invalid purchase return status");
    }),
  amountAdjusted: coerceNumber(0, 0).optional(),
  notes: nullableString(2000),
});

export type PurchaseReturnItemInput = z.infer<typeof purchaseReturnItemSchema>;
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
export type UpdatePurchaseReturnInput = z.infer<typeof updatePurchaseReturnSchema>;
export type PurchaseReturnQueryParams = z.infer<typeof purchaseReturnQuerySchema>;
export type EligiblePurchaseQueryParams = z.infer<typeof eligiblePurchaseQuerySchema>;
export type UpdatePurchaseReturnStatusInput = z.infer<
  typeof updatePurchaseReturnStatusSchema
>;
