import { z } from "zod";

/**
 * Query schema for outstanding receivables & payables analysis
 */
export const outstandingQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return "ALL";
      const upper = val.toUpperCase();
      if (upper === "OVERDUE" || upper === "DUE TODAY" || upper === "PENDING") {
        return upper as "OVERDUE" | "DUE TODAY" | "PENDING";
      }
      return "ALL";
    }),
  bucket: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return "ALL";
      const clean = val.trim();
      if (clean === "0-30" || clean === "31-60" || clean === "61-90" || clean === "91+") {
        return clean as "0-30" | "31-60" | "61-90" | "91+";
      }
      return "ALL";
    }),
  search: z.string().trim().optional(),
  partyId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.string().default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type OutstandingQueryParams = z.infer<typeof outstandingQuerySchema>;

