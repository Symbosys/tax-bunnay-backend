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
 * 1. General Ledger Query / Filter Schema
 * Matches all filters in the Flutter General Ledger UI
 */
export const generalLedgerQuerySchema = z.object({
  search: z.string().trim().optional(),
  account: z.string().trim().optional().default("All Accounts"),
  voucherType: z.string().trim().optional().default("All Vouchers"),
  type: z.string().trim().optional().default("All Types"), // 'All Types' | 'Debit Only' | 'Credit Only'
  startDate: parseDate(),
  endDate: parseDate(),
  sortBy: z.string().trim().optional().default("Date (Newest)"), // 'Date (Newest)' | 'Date (Oldest)' | 'Amount (High to Low)' | 'Amount (Low to High)'
  page: coerceNumber(1, 1),
  limit: coerceNumber(10, 1),
});

export type GeneralLedgerQueryParams = z.infer<typeof generalLedgerQuerySchema>;

/**
 * 2. Double-Entry Journal Line Schema
 */
export const journalLineInputSchema = z.object({
  accountId: z.string().trim().min(1, "Account ID or name is required"),
  accountName: z.string().trim().optional(),
  debit: z
    .union([z.number(), z.string()])
    .optional()
    .default(0)
    .transform((val) => Math.max(0, Number(val) || 0)),
  credit: z
    .union([z.number(), z.string()])
    .optional()
    .default(0)
    .transform((val) => Math.max(0, Number(val) || 0)),
  narration: z.string().trim().optional(),
});

export type JournalLineInput = z.infer<typeof journalLineInputSchema>;

/**
 * 3. Create Journal Voucher Schema (with balanced double-entry validation)
 */
export const createJournalVoucherSchema = z
  .object({
    entryDate: parseDate(),
    voucherNo: z.string().trim().optional(),
    voucherType: z
      .string()
      .trim()
      .optional()
      .default("Journal Voucher"), // 'Journal Voucher' | 'Payment' | 'Receipt' | 'Contra' | 'Sales Invoice' | 'Purchase Invoice'
    narration: z.string().trim().min(1, "Narration is required"),
    referenceType: z.string().trim().optional(),
    referenceId: z.string().trim().optional(),
    lines: z
      .array(journalLineInputSchema)
      .min(2, "Double-entry transaction requires at least 2 legs (debit & credit)"),
  })
  .refine(
    (data) => {
      const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    {
      message: "Double-entry transaction is unbalanced: Total Debits must equal Total Credits",
      path: ["lines"],
    }
  );

export type CreateJournalVoucherInput = z.infer<typeof createJournalVoucherSchema>;

/**
 * 4. Export Ledger Query Schema
 */
export const exportLedgerQuerySchema = generalLedgerQuerySchema.extend({
  format: z.enum(["csv", "json"]).optional().default("csv"),
});

export type ExportLedgerQueryParams = z.infer<typeof exportLedgerQuerySchema>;
