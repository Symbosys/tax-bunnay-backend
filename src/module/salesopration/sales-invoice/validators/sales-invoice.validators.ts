import { z } from "zod";
import {
  GstSupplyType,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
} from "../../../../generated/prisma/enums";

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

export const paymentModeSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return PaymentMode.CASH;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "CASH") return PaymentMode.CASH;
    if (normalized === "UPI") return PaymentMode.UPI;
    if (normalized === "CARD") return PaymentMode.CARD;
    if (normalized === "BANK") return PaymentMode.BANK;
    if (normalized === "CHEQUE") return PaymentMode.CHEQUE;
    if (normalized === "CREDIT" || normalized === "CREDIT_NOTE") return PaymentMode.CREDIT;
    return PaymentMode.OTHER;
  });

export const paymentStatusSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return PaymentStatus.PAID;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "PAID") return PaymentStatus.PAID;
    if (normalized === "PARTIALLY_PAID" || normalized === "PARTIAL") return PaymentStatus.PARTIALLY_PAID;
    if (normalized === "OVERDUE") return PaymentStatus.OVERDUE;
    return PaymentStatus.UNPAID;
  });

export const invoiceStatusSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return InvoiceStatus.SAVED;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "SAVED") return InvoiceStatus.SAVED;
    if (normalized === "DRAFT") return InvoiceStatus.DRAFT;
    if (normalized === "PRINTED") return InvoiceStatus.PRINTED;
    if (normalized === "CANCELLED") return InvoiceStatus.CANCELLED;
    if (normalized === "HELD" || normalized === "PARKED") return InvoiceStatus.HELD;
    return InvoiceStatus.SAVED;
  });

export const gstSupplyTypeSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return GstSupplyType.B2C;
    const normalized = val.toUpperCase().replace(/[\s-]/g, "_");
    if (normalized === "B2B") return GstSupplyType.B2B;
    if (normalized === "B2C") return GstSupplyType.B2C;
    if (normalized === "EXPORT") return GstSupplyType.EXPORT;
    if (normalized === "EXEMPT") return GstSupplyType.EXEMPT;
    if (normalized === "NIL_RATED") return GstSupplyType.NIL_RATED;
    if (normalized === "NON_GST") return GstSupplyType.NON_GST;
    if (normalized === "REVERSE_CHARGE") return GstSupplyType.REVERSE_CHARGE;
    return GstSupplyType.B2C;
  });

/**
 * Line item on a Sales Invoice — matches Sales & POS UI.
 */
export const salesInvoiceItemSchema = z.object({
  productId: nullableString(100),
  serviceId: nullableString(100),
  name: nullableString(255),
  productName: nullableString(255),
  hsnOrSacCode: nullableString(20),
  hsnCode: nullableString(20),
  quantity: coerceNumber(1, 0.001),
  unit: z.string().trim().optional().default("PCS"),
  rate: coerceNumber(0, 0),
  price: coerceNumber(0, 0).optional(),
  mrp: coerceNumber(0, 0).optional(),
  discountPercent: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  gstRatePercent: coerceNumber(0, 0),
  gstRate: coerceNumber(0, 0).optional(),
  cgstAmount: coerceNumber(0, 0),
  sgstAmount: coerceNumber(0, 0),
  igstAmount: coerceNumber(0, 0),
  cessAmount: coerceNumber(0, 0),
  lineTotal: coerceNumber(0, 0),
  amount: coerceNumber(0, 0).optional(),
}).transform((data) => {
  const finalRate = data.rate > 0 ? data.rate : (data.price ?? 0);
  const finalName = data.productName ?? data.name ?? "Item";
  const finalGst = data.gstRatePercent > 0 ? data.gstRatePercent : (data.gstRate ?? 0);
  const finalHsn = data.hsnOrSacCode ?? data.hsnCode ?? null;
  const lineAmount = data.lineTotal > 0 ? data.lineTotal : (data.amount ?? (data.quantity * finalRate));

  return {
    productId: data.productId,
    serviceId: data.serviceId,
    productName: finalName,
    hsnOrSacCode: finalHsn,
    quantity: data.quantity,
    unit: data.unit || "PCS",
    rate: finalRate,
    mrp: data.mrp ?? finalRate,
    discountPercent: data.discountPercent,
    discountAmount: data.discountAmount,
    taxableValue: data.taxableValue > 0 ? data.taxableValue : lineAmount,
    gstRatePercent: finalGst,
    cgstAmount: data.cgstAmount,
    sgstAmount: data.sgstAmount,
    igstAmount: data.igstAmount,
    cessAmount: data.cessAmount,
    lineTotal: lineAmount,
  };
});

/**
 * Create Sales Invoice input payload
 */
export const createSalesInvoiceSchema = z.object({
  seriesId: nullableString(100),
  invoiceNumber: nullableString(50),
  invoiceDate: coerceDate,
  customerId: nullableString(100),
  customerName: nullableString(255).transform((val) => val || "Walk-in Customer"),
  customerPhone: nullableString(50),
  billingAddress: nullableString(500),
  shippingAddress: nullableString(500),
  placeOfSupply: nullableString(100),
  supplyType: gstSupplyTypeSchema,
  isReverseCharge: z.boolean().optional().default(false),
  subtotal: coerceNumber(0, 0),
  discountPercent: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  cgstAmount: coerceNumber(0, 0),
  sgstAmount: coerceNumber(0, 0),
  igstAmount: coerceNumber(0, 0),
  cessAmount: coerceNumber(0, 0),
  roundOff: coerceNumber(0, 0),
  grandTotal: coerceNumber(0, 0),
  paidAmount: coerceNumber(0, 0),
  balanceAmount: coerceNumber(0, 0),
  changeReturned: coerceNumber(0, 0),
  amountInWords: nullableString(255),
  paymentMode: paymentModeSchema,
  paymentStatus: paymentStatusSchema,
  notes: nullableString(2000),
  termsAndConditions: nullableString(2000),
  status: invoiceStatusSchema,
  isHeld: z.boolean().optional().default(false),
  warehouseId: nullableString(100),
  items: z.array(salesInvoiceItemSchema).min(1, "Please add at least one line item to generate an invoice"),
});

/**
 * Update Sales Invoice input payload
 */
export const updateSalesInvoiceSchema = z.object({
  seriesId: nullableString(100),
  invoiceNumber: nullableString(50),
  invoiceDate: coerceDate.optional(),
  customerId: nullableString(100),
  customerName: nullableString(255).optional(),
  customerPhone: nullableString(50),
  billingAddress: nullableString(500),
  shippingAddress: nullableString(500),
  placeOfSupply: nullableString(100),
  supplyType: gstSupplyTypeSchema.optional(),
  isReverseCharge: z.boolean().optional(),
  subtotal: coerceNumber(0, 0).optional(),
  discountPercent: coerceNumber(0, 0).optional(),
  discountAmount: coerceNumber(0, 0).optional(),
  taxableValue: coerceNumber(0, 0).optional(),
  cgstAmount: coerceNumber(0, 0).optional(),
  sgstAmount: coerceNumber(0, 0).optional(),
  igstAmount: coerceNumber(0, 0).optional(),
  cessAmount: coerceNumber(0, 0).optional(),
  roundOff: coerceNumber(0, 0).optional(),
  grandTotal: coerceNumber(0, 0).optional(),
  paidAmount: coerceNumber(0, 0).optional(),
  balanceAmount: coerceNumber(0, 0).optional(),
  changeReturned: coerceNumber(0, 0).optional(),
  amountInWords: nullableString(255),
  paymentMode: paymentModeSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: nullableString(2000),
  termsAndConditions: nullableString(2000),
  status: invoiceStatusSchema.optional(),
  isHeld: z.boolean().optional(),
  warehouseId: nullableString(100),
  items: z.array(salesInvoiceItemSchema).min(1).optional(),
});

/**
 * Fast Hold Cart schema
 */
export const holdSalesInvoiceSchema = z.object({
  customerName: nullableString(255).transform((val) => val || "Walk-in Customer"),
  customerPhone: nullableString(50),
  notes: nullableString(1000),
  discountPercent: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  items: z.array(salesInvoiceItemSchema).min(1, "Cannot hold an empty cart"),
});

/**
 * Query schema for listing sales invoices
 */
export const salesInvoiceQuerySchema = z.object({
  search: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  isHeld: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      return val === true || val === "true" || val === "1";
    }),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(20, 1),
});

export type SalesInvoiceItemInput = z.infer<typeof salesInvoiceItemSchema>;
export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type UpdateSalesInvoiceInput = z.infer<typeof updateSalesInvoiceSchema>;
export type HoldSalesInvoiceInput = z.infer<typeof holdSalesInvoiceSchema>;
export type SalesInvoiceQueryParams = z.infer<typeof salesInvoiceQuerySchema>;
