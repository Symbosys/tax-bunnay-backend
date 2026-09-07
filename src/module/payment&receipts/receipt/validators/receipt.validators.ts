import { z } from "zod";
import { PaymentMode } from "../../../../generated/prisma/enums";

/**
 * Single invoice allocation item for a Receipt
 */
export const receiptAllocationInputSchema = z.object({
  invoiceId: z.string().trim().min(1, "Invoice ID is required"),
  allocatedAmount: z.number().positive("Allocated amount must be positive"),
});

export type ReceiptAllocationInput = z.infer<typeof receiptAllocationInputSchema>;

/**
 * Validation schema for creating a customer Receipt
 */
export const createReceiptSchema = z.object({
  customerId: z.string().trim().min(1, "Customer ID is required"),
  amount: z.number().positive("Receipt amount must be greater than 0"),
  receiptDate: z.coerce.date().default(() => new Date()),
  paymentMode: z
    .enum([
      PaymentMode.CASH,
      PaymentMode.BANK,
      PaymentMode.UPI,
      PaymentMode.CARD,
      PaymentMode.CHEQUE,
      PaymentMode.CREDIT,
      PaymentMode.OTHER,
    ])
    .default(PaymentMode.BANK),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  allocations: z.array(receiptAllocationInputSchema).optional().default([]),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

/**
 * Query schema for listing and filtering receipts
 */
export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  paymentMode: z
    .enum([
      PaymentMode.CASH,
      PaymentMode.BANK,
      PaymentMode.UPI,
      PaymentMode.CARD,
      PaymentMode.CHEQUE,
      PaymentMode.CREDIT,
      PaymentMode.OTHER,
    ])
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.string().default("receiptDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ReceiptQueryParams = z.infer<typeof receiptQuerySchema>;
