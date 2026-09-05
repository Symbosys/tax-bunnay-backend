import { z } from "zod";

/**
 * Standard 15-character GSTIN Regex:
 * 2 digits (State Code) + 5 letters (PAN letters) + 4 digits (PAN numbers) + 
 * 1 letter (PAN checksum) + 1 alphanumeric (Entity count) + 'Z' (Default) + 1 check digit
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const gstinParamSchema = z.object({
  gstin: z
    .string({ message: "GSTIN is required" })
    .trim()
    .toUpperCase()
    .length(15, "GSTIN must be exactly 15 characters long")
    .regex(GSTIN_REGEX, "Invalid GSTIN format (e.g., 27AAAAA0000A1Z5)"),
});

export const gstinLookupSchema = z.object({
  gstin: z
    .string({ message: "GSTIN is required" })
    .trim()
    .toUpperCase()
    .length(15, "GSTIN must be exactly 15 characters long")
    .regex(GSTIN_REGEX, "Invalid GSTIN format (e.g., 27AAAAA0000A1Z5)"),
});

export const updateGstProfileSchema = z.object({
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, "Invalid GSTIN format")
    .optional()
    .nullable(),
  legalName: z.string().trim().min(2, "Legal name must be at least 2 characters").optional(),
  tradeName: z.string().trim().optional().nullable(),
  registrationDate: z.string().trim().optional().nullable(),
  primaryPlaceOfBusiness: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  stateCode: z.string().trim().optional().nullable(),
  taxpayerType: z.enum(["REGULAR", "COMPOSITION", "SEZ", "NON_RESIDENT", "UNREGISTERED"]).optional(),
  status: z.enum(["Active", "Inactive", "Suspended", "Cancelled"]).optional(),
  filingFrequency: z.enum(["Monthly", "Quarterly"]).optional(),
});

export const fileReturnSchema = z.object({
  returnType: z.enum(["GSTR-1", "GSTR-3B", "GSTR-2B", "GSTR-9"], {
    message: "Return type is required (e.g. GSTR-1, GSTR-3B)",
  }),
  taxPeriod: z.string({ message: "Tax period is required (e.g. May 2026)" }).trim(),
  arn: z.string().trim().optional(),
  liabilityAmount: z.coerce.number().nonnegative().optional().nullable(),
  taxableAmount: z.coerce.number().nonnegative().optional(),
  cgstAmount: z.coerce.number().nonnegative().optional(),
  sgstAmount: z.coerce.number().nonnegative().optional(),
  igstAmount: z.coerce.number().nonnegative().optional(),
  cessAmount: z.coerce.number().nonnegative().optional(),
  totalTax: z.coerce.number().nonnegative().optional(),
  totalInvoices: z.coerce.number().int().nonnegative().optional(),
  rawPayloadJson: z.string().optional(),
});

export const gstReturnsQuerySchema = z.object({
  taxPeriod: z.string().trim().optional(),
  returnType: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const recordGstPaymentSchema = z.object({
  challanNumber: z.string({ message: "Challan number is required" }).trim(),
  cpin: z.string().trim().optional().nullable(),
  taxPeriod: z.string({ message: "Tax period is required" }).trim(),
  paymentDate: z.string().optional(),
  cgstAmount: z.coerce.number().nonnegative().optional().default(0),
  sgstAmount: z.coerce.number().nonnegative().optional().default(0),
  igstAmount: z.coerce.number().nonnegative().optional().default(0),
  cessAmount: z.coerce.number().nonnegative().optional().default(0),
  paymentMode: z.string().trim().optional().default("NEFT/RTGS"),
  bankName: z.string().trim().optional().nullable(),
  brn: z.string().trim().optional().nullable(),
});

export type UpdateGstProfileInput = z.infer<typeof updateGstProfileSchema>;
export type FileReturnInput = z.infer<typeof fileReturnSchema>;
export type GstReturnsQuery = z.infer<typeof gstReturnsQuerySchema>;
export type RecordGstPaymentInput = z.infer<typeof recordGstPaymentSchema>;
