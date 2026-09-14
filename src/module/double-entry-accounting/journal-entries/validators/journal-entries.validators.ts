import { z } from "zod";

export const journalEntriesQuerySchema = z.object({
  tab: z
    .string()
    .optional()
    .default("all")
    .transform((val) => {
      const lower = val.toLowerCase().trim();
      if (lower.includes("draft")) return "drafts";
      if (lower.includes("recur")) return "recurring";
      if (lower.includes("template")) return "templates";
      return "all";
    }),
  search: z.string().optional(),
  type: z.string().optional().default("all"),
  status: z.string().optional().default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("Date (Newest)"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const journalEntryLineInputSchema = z.object({
  accountId: z.string().min(1, "Account ID or Code is required"),
  accountName: z.string().optional(),
  accountCode: z.string().optional(),
  debitAmount: z.coerce.number().min(0).default(0),
  creditAmount: z.coerce.number().min(0).default(0),
  narration: z.string().optional(),
});

export const createJournalEntrySchema = z
  .object({
    entryDate: z.string().or(z.date()).optional(),
    type: z.string().optional().default("standard"),
    status: z.string().optional().default("posted"),
    reference: z.string().optional().default(""),
    narration: z.string().min(1, "Narration is required"),
    // Comprehensive lines array
    lines: z.array(journalEntryLineInputSchema).optional(),
    // Simplified 2-leg fields (from quick modal dialogs)
    debitAccountId: z.string().optional(),
    creditAccountId: z.string().optional(),
    debitAmount: z.coerce.number().min(0).optional(),
    creditAmount: z.coerce.number().min(0).optional(),
  })
  .refine(
    (data) => {
      const hasLines = data.lines && data.lines.length >= 2;
      const hasQuickLegs =
        Boolean(data.debitAccountId) &&
        Boolean(data.creditAccountId) &&
        (data.debitAmount ?? 0) > 0;
      return hasLines || hasQuickLegs;
    },
    {
      message:
        "At least two double-entry legs (or both debit and credit accounts with positive amounts) are required.",
    }
  );

export const updateJournalEntrySchema = z.object({
  entryDate: z.string().or(z.date()).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  reference: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(journalEntryLineInputSchema).optional(),
});

export const exportJournalQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  tab: z.string().optional(),
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional(),
});

export type JournalEntriesQueryParams = z.infer<typeof journalEntriesQuerySchema>;
export type JournalEntryLineInput = z.infer<typeof journalEntryLineInputSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type ExportJournalQueryParams = z.infer<typeof exportJournalQuerySchema>;
