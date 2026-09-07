import { z } from "zod";
import { PaymentMode } from "../../../../generated/prisma/enums";

/**
 * Single purchase bill allocation item for a Supplier Payment
 */
export const paymentAllocationInputSchema = z.object({
  purchaseId: z.string().trim().min(1, "Purchase bill ID is required"),
  amountAllocated: z.number().positive("Allocated amount must be positive"),
});

export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;

/**
 * Validation schema for recording a Supplier Payment
 */
export const createPaymentSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier ID is required"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paymentDate: z.coerce.date().default(() => new Date()),
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
  purchaseId: z.string().trim().optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).optional().default([]),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Query schema for listing and filtering payments
 */
export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
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
  sortBy: z.string().default("paymentDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaymentQueryParams = z.infer<typeof paymentQuerySchema>;
