import { z } from "zod";

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
 * 1. Open POS Register Session Schema
 */
export const openPosSessionSchema = z.object({
  openingCash: coerceNumber(0, 0),
  warehouseId: z.string().trim().optional().default("main"),
  posMachineId: nullableString(50),
  notes: nullableString(500),
});

export type OpenPosSessionInput = z.infer<typeof openPosSessionSchema>;

/**
 * 2. Close POS Register Session Schema
 */
export const closePosSessionSchema = z.object({
  actualClosingCash: coerceNumber(0, 0),
  closingNotes: nullableString(500),
});

export type ClosePosSessionInput = z.infer<typeof closePosSessionSchema>;

/**
 * 3. Product query / search for POS catalog
 */
export const posProductQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  barcode: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  category: z.string().trim().optional(),
  page: coerceNumber(1, 1),
  limit: coerceNumber(50, 1),
});

export type PosProductQueryParams = z.infer<typeof posProductQuerySchema>;

/**
 * 4. Single POS Cart Item Schema
 */
export const posCartItemSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  serviceId: nullableString(100),
  name: z.string().trim().min(1, "Item name is required"),
  hsnSac: nullableString(20),
  quantity: coerceNumber(1, 0.001),
  unit: z.string().trim().optional().default("PCS"),
  rate: coerceNumber(0, 0),
  discountPercentage: coerceNumber(0, 0),
  discountAmount: coerceNumber(0, 0),
  taxableValue: coerceNumber(0, 0),
  gstRate: coerceNumber(0, 0),
  cgst: coerceNumber(0, 0),
  sgst: coerceNumber(0, 0),
  igst: coerceNumber(0, 0),
  cess: coerceNumber(0, 0),
  warehouseId: nullableString(100),
});

export type PosCartItemInput = z.infer<typeof posCartItemSchema>;

/**
 * 5. POS Checkout / Sale Transaction Schema
 */
export const posCheckoutSchema = z.object({
  customerId: z.string().trim().optional(),
  customerName: nullableString(255),
  warehouseId: z.string().trim().optional().default("main"),
  items: z.array(posCartItemSchema).min(1, "At least one item is required in cart"),
  cartDiscountPercent: coerceNumber(0, 0),
  cartDiscountAmount: coerceNumber(0, 0),
  subtotal: coerceNumber(0, 0),
  tax: coerceNumber(0, 0),
  roundOff: coerceNumber(0, -50),
  grandTotal: coerceNumber(0, 0),
  paymentMode: z
    .enum(["Cash", "UPI", "Card", "Credit", "Split", "Other"])
    .default("Cash"),
  splitPayments: z
    .array(
      z.object({
        mode: z.enum(["Cash", "UPI", "Card", "Credit", "Other"]),
        amount: coerceNumber(0, 0),
        referenceNumber: nullableString(100),
      })
    )
    .optional()
    .default([]),
  tenderedCash: coerceNumber(0, 0),
  changeDue: coerceNumber(0, 0),
  notes: nullableString(500).default("POS Fast Billing Sale"),
  termsConditions: nullableString(500).default("Goods once sold are not returnable."),
});

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>;

/**
 * 6. Park / Hold Cart Schema
 */
export const holdPosCartSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required to hold cart"),
  customerName: z.string().trim().optional().default("Customer"),
  warehouseId: z.string().trim().optional().default("main"),
  items: z.array(posCartItemSchema).min(1, "Cannot hold an empty cart"),
  cartDiscountPercent: coerceNumber(0, 0),
  subtotal: coerceNumber(0, 0),
  tax: coerceNumber(0, 0),
  grandTotal: coerceNumber(0, 0),
  notes: nullableString(255).default("POS Held Cart"),
});

export type HoldPosCartInput = z.infer<typeof holdPosCartSchema>;

/**
 * 7. Quick Customer Creation Schema (from POS counter)
 */
export const quickCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(255),
  mobileNumber: nullableString(20),
  email: nullableString(100),
  state: nullableString(50).default("Delhi"),
  gstin: nullableString(20),
  billingAddress: nullableString(255),
});

export type QuickCustomerInput = z.infer<typeof quickCustomerSchema>;
