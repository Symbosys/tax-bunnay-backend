import { z } from "zod";

/**
 * Regex for Indian Services Accounting Code (SAC)
 * SAC codes are typically 4 to 6 digits, starting with 99
 */
export const SAC_CODE_REGEX = /^[0-9]{2,8}$/;

/**
 * Helper to preprocess string fields that might be empty strings to null or trimmed string
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
 * Validator schema for creating a new Service item
 * Aligned with Flutter ServiceFormPage and Prisma Service model
 */
export const createServiceSchema = z
  .object({
    name: z
      .string({
        error: "Service name is required",
      })
      .trim()
      .min(1, "Service name is required")
      .max(150, "Service name cannot exceed 150 characters"),

    // Service Reference Code (accepts code or serviceCode)
    serviceCode: nullableString(50),
    code: nullableString(50),

    // SAC Code (Services Accounting Code)
    sacCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || SAC_CODE_REGEX.test(val),
        "SAC Code must be numeric (e.g. 9965, 9983)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // Description / Scope of Work
    description: nullableString(1000),

    // Standard Billing Rate (Rate per unit)
    rate: z
      .union([z.number(), z.string()])
      .default(0)
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),

    // GST Tax Rate (percentage, e.g. 18.0)
    gstRatePercent: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 18;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 18 : Math.max(0, Math.min(100, num));
      }),
    gstRate: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? undefined : Math.max(0, Math.min(100, num));
      }),

    // Billing Unit (Hour, Day, Job, Trip, Month, Project, etc.)
    unit: z
      .string()
      .trim()
      .max(50)
      .optional()
      .nullable()
      .default("Hour")
      .transform((val) => (val === "" || val === undefined || val === null ? "Hour" : val)),

    // Standard Discount
    discountPercent: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    discount: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? undefined : Math.max(0, num);
      }),

    // Income Ledger mapping / Account reference
    incomeLedgerId: nullableString(100),
    incomeLedger: nullableString(100),

    // Active Status
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    // Reconcile code and serviceCode
    const finalCode = data.serviceCode ?? data.code ?? null;

    // Reconcile gstRate and gstRatePercent
    const finalGstRate = data.gstRate ?? data.gstRatePercent ?? 18;

    // Reconcile discount and discountPercent
    const finalDiscount = data.discount ?? data.discountPercent ?? 0;

    // Reconcile incomeLedgerId and incomeLedger
    const finalIncomeLedger = data.incomeLedgerId ?? data.incomeLedger ?? null;

    return {
      name: data.name,
      serviceCode: finalCode,
      sacCode: data.sacCode,
      description: data.description,
      rate: data.rate,
      gstRatePercent: finalGstRate,
      unit: data.unit ?? "Hour",
      discountPercent: finalDiscount,
      incomeLedgerId: finalIncomeLedger,
      isActive: data.isActive,
    };
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Validator schema for updating an existing Service item
 */
export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    serviceCode: nullableString(50),
    code: nullableString(50),
    sacCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || SAC_CODE_REGEX.test(val),
        "SAC Code must be numeric"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    description: nullableString(1000),
    rate: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    gstRatePercent: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 18;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 18 : Math.max(0, Math.min(100, num));
      }),
    gstRate: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 18;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 18 : Math.max(0, Math.min(100, num));
      }),
    unit: nullableString(50),
    discountPercent: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    discount: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    incomeLedgerId: nullableString(100),
    incomeLedger: nullableString(100),
    isActive: z.boolean().optional(),
  })
  .transform((data) => {
    const res: Record<string, any> = {};

    if (data.name !== undefined) res.name = data.name;

    const code = data.serviceCode ?? data.code;
    if (code !== undefined) res.serviceCode = code;

    if (data.sacCode !== undefined) res.sacCode = data.sacCode;
    if (data.description !== undefined) res.description = data.description;
    if (data.rate !== undefined) res.rate = data.rate;

    const gst = data.gstRate ?? data.gstRatePercent;
    if (gst !== undefined) res.gstRatePercent = gst;

    if (data.unit !== undefined) res.unit = data.unit;

    const discount = data.discount ?? data.discountPercent;
    if (discount !== undefined) res.discountPercent = discount;

    const ledger = data.incomeLedgerId ?? data.incomeLedger;
    if (ledger !== undefined) res.incomeLedgerId = ledger;

    if (data.isActive !== undefined) res.isActive = data.isActive;

    return res;
  });

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Query schema for searching, filtering, and paginating services
 */
export const serviceQuerySchema = z.object({
  search: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return undefined;
      if (typeof val === "boolean") return val;
      if (val === "true" || val === "1") return true;
      if (val === "false" || val === "0") return false;
      return undefined;
    }),
  page: z
    .union([z.number(), z.string()])
    .optional()
    .default(1)
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .default(20)
    .transform((val) => {
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(num) || num < 1 ? 20 : Math.min(num, 100);
    }),
  sortBy: z
    .enum(["name", "serviceCode", "rate", "createdAt", "updatedAt"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc", "ASC", "DESC"])
    .optional()
    .default("desc")
    .transform((val) => val.toLowerCase() as "asc" | "desc"),
});

export type ServiceQueryParams = z.infer<typeof serviceQuerySchema>;
