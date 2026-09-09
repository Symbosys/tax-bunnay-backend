import { z } from "zod";
import { PaymentMode, PurchaseStatus } from "../../../../generated/prisma/enums";

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

const paymentModeSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return PaymentMode.BANK;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "BANK") return PaymentMode.BANK;
    if (normalized === "CASH") return PaymentMode.CASH;
    if (normalized === "UPI") return PaymentMode.UPI;
    if (normalized === "CARD") return PaymentMode.CARD;
    if (normalized === "CHEQUE") return PaymentMode.CHEQUE;
    if (normalized === "CREDIT" || normalized === "CREDIT_NOTE") return PaymentMode.CREDIT;
    return PaymentMode.OTHER;
  });

const purchaseStatusInputSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return PurchaseStatus.DRAFT;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "CONFIRMED") return PurchaseStatus.CONFIRMED;
    if (normalized === "CANCELLED") return PurchaseStatus.CANCELLED;
    return PurchaseStatus.DRAFT;
  });

/**
 * Line item on a purchase bill — matches Record Purchase Bill UI.
 */
export const purchaseBillItemSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  name: nullableString(255),
  productName: nullableString(255),
  category: nullableString(100),
  subCategory: nullableString(100),
  hsnCode: nullableString(20),
  quantity: coerceNumber(1, 0.001),
  unit: z.string().trim().optional().default("PCS"),
  rate: coerceNumber(0, 0),
  discountPercent: coerceNumber(0, 0),
  discountPercentage: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  gstRate: coerceNumber(0, 0),
  gstRatePercent: coerceNumber(0, 0),
  cgst: coerceNumber(0, 0),
  sgst: coerceNumber(0, 0),
  igst: coerceNumber(0, 0),
  cess: coerceNumber(0, 0),
  cgstAmount: coerceNumber(0, 0),
  sgstAmount: coerceNumber(0, 0),
  igstAmount: coerceNumber(0, 0),
  cessAmount: coerceNumber(0, 0),
  lineTotal: coerceNumber(0, 0),
});

export const createPurchaseBillSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required"),
  purchaseNumber: nullableString(50),
  supplierInvoiceNumber: z
    .string({ message: "Supplier invoice number is required" })
    .trim()
    .min(1, "Supplier invoice number is required")
    .max(100),
  purchaseDate: coerceDate,
  warehouseId: nullableString(100),
  freight: coerceNumber(0, 0),
  freightCharges: coerceNumber(0, 0),
  otherCharges: coerceNumber(0, 0),
  notes: nullableString(2000),
  paymentMode: paymentModeSchema,
  status: purchaseStatusInputSchema,
  originalPurchaseId: nullableString(100),
  items: z.array(purchaseBillItemSchema).min(1, "Please add at least one product item"),
});

export const updatePurchaseBillSchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  purchaseNumber: nullableString(50),
  supplierInvoiceNumber: z.string().trim().min(1).max(100).optional(),
  purchaseDate: coerceDate.optional(),
  warehouseId: nullableString(100),
  freight: coerceNumber(0, 0).optional(),
  freightCharges: coerceNumber(0, 0).optional(),
  otherCharges: coerceNumber(0, 0).optional(),
  notes: nullableString(2000),
  paymentMode: paymentModeSchema.optional(),
  status: purchaseStatusInputSchema.optional(),
  originalPurchaseId: nullableString(100),
  items: z.array(purchaseBillItemSchema).min(1).optional(),
});

export const purchaseBillQuerySchema = z.object({
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(20, 1),
});

export const purchaseProductQuerySchema = z.object({
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1),
});

const HSN_CODE_REGEX = /^[0-9]{2,8}$/;

/**
 * Create a product from the purchase bill screen (full master fields).
 */
export const createPurchaseProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required").max(255),
    itemCode: nullableString(50),
    code: nullableString(50),
    sku: nullableString(50),
    barcode: nullableString(100),
    hsnCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || HSN_CODE_REGEX.test(val),
        "HSN Code must be numeric (2 to 8 digits)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    primaryUnit: z
      .string()
      .trim()
      .optional()
      .default("PCS")
      .transform((val) => (!val || val === "" ? "PCS" : val.toUpperCase())),
    secondaryUnit: nullableString(20),
    gstRatePercent: coerceNumber(0, 0),
    gstRate: coerceNumber(0, 0),
    purchasePrice: coerceNumber(0, 0),
    sellingPrice: coerceNumber(0, 0),
    mrp: coerceNumber(0, 0),
    wholesalePrice: coerceNumber(0, 0),
    minStockLevel: coerceNumber(0, 0),
    openingStock: coerceNumber(0, 0),
    hasBatchTracking: z.boolean().optional().default(false),
    hasSerialTracking: z.boolean().optional().default(false),
    hasExpiryTracking: z.boolean().optional().default(false),
    warehouseId: nullableString(100),
    rackOrBin: nullableString(50),
    category: nullableString(100),
    subCategory: nullableString(100),
    brand: nullableString(100),
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    const gstRate = data.gstRatePercent > 0 ? data.gstRatePercent : data.gstRate;
    return {
      name: data.name,
      itemCode: data.itemCode ?? data.code,
      sku: data.sku,
      barcode: data.barcode,
      hsnCode: data.hsnCode,
      primaryUnit: data.primaryUnit,
      secondaryUnit: data.secondaryUnit,
      gstRatePercent: gstRate,
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      mrp: data.mrp,
      wholesalePrice: data.wholesalePrice,
      minStockLevel: data.minStockLevel,
      openingStock: data.openingStock,
      hasBatchTracking: data.hasBatchTracking,
      hasSerialTracking: data.hasSerialTracking,
      hasExpiryTracking: data.hasExpiryTracking,
      warehouseId: data.warehouseId,
      rackOrBin: data.rackOrBin,
      category: data.category ?? "General",
      subCategory: data.subCategory,
      brand: data.brand,
      isActive: data.isActive,
    };
  });

export type PurchaseBillItemInput = z.infer<typeof purchaseBillItemSchema>;
export type CreatePurchaseBillInput = z.infer<typeof createPurchaseBillSchema>;
export type UpdatePurchaseBillInput = z.infer<typeof updatePurchaseBillSchema>;
export type PurchaseBillQueryParams = z.infer<typeof purchaseBillQuerySchema>;
export type PurchaseProductQueryParams = z.infer<typeof purchaseProductQuerySchema>;
export type CreatePurchaseProductInput = z.infer<typeof createPurchaseProductSchema>;
