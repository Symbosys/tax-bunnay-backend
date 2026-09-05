import { z } from "zod";
import {
  GST_STATE_CODES,
  GSTIN_REGEX,
  MOBILE_REGEX,
  PAN_REGEX,
} from "../../customer/validators/customer.validators";


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
 * Validator schema for creating a new Supplier
 * Aligned with Flutter SupplierFormPage and Prisma Supplier model
 */
export const createSupplierSchema = z
  .object({
    name: z
      .string({
        error: "Supplier company name is required",
      })
      .trim()
      .min(1, "Supplier company name is required")
      .max(150, "Supplier name cannot exceed 150 characters"),

    // GSTIN (15 characters)
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || GSTIN_REGEX.test(val),
        "Invalid Indian GSTIN format (e.g. 27AADCA1234F1Z5)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // PAN (10 characters)
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || PAN_REGEX.test(val),
        "Invalid Indian PAN format (e.g. AADCA1234F)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // Mobile / Contact number (accepts mobileNumber or mobile)
    mobileNumber: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || MOBILE_REGEX.test(val),
        "Invalid contact/mobile number format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    mobile: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || MOBILE_REGEX.test(val),
        "Invalid contact/mobile number format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // Email
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address format")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // Address
    address: nullableString(500),

    // State & State Code
    state: nullableString(100),
    stateCode: nullableString(10),

    // Credit terms (stored as String in Prisma, accepts int or string in UI)
    creditTerms: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return "0";
        return val.toString().trim();
      }),

    // Opening Balance
    openingBalance: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .default(0)
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : num;
      }),

    // Grouping & Notes
    supplierGroup: nullableString(100),
    notes: nullableString(1000),

    // Status
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    // Reconcile mobile / mobileNumber
    const finalMobile = data.mobileNumber ?? data.mobile ?? null;

    // Auto-extract state and PAN from GSTIN if missing
    let finalState = data.state;
    let finalPan = data.pan;

    if (data.gstin && data.gstin.length === 15) {
      const gstinStateCode = data.gstin.substring(0, 2);
      if (!finalState && GST_STATE_CODES[gstinStateCode]) {
        finalState = GST_STATE_CODES[gstinStateCode];
      }
      if (!finalPan) {
        finalPan = data.gstin.substring(2, 12);
      }
    }

    return {
      name: data.name,
      gstin: data.gstin,
      pan: finalPan,
      mobileNumber: finalMobile,
      email: data.email,
      address: data.address,
      state: finalState,
      creditTerms: data.creditTerms ?? "0",
      openingBalance: data.openingBalance ?? 0,
      supplierGroup: data.supplierGroup ?? "General",
      notes: data.notes,
      isActive: data.isActive,
    };
  });

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

/**
 * Validator schema for updating an existing Supplier
 */
export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || GSTIN_REGEX.test(val),
        "Invalid Indian GSTIN format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || PAN_REGEX.test(val),
        "Invalid Indian PAN format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    mobileNumber: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || MOBILE_REGEX.test(val),
        "Invalid contact number format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    mobile: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || MOBILE_REGEX.test(val),
        "Invalid contact number format"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address format")
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((val) => (val === "" || val === undefined ? null : val)),
    address: nullableString(500),
    state: nullableString(100),
    creditTerms: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return "0";
        return val.toString().trim();
      }),
    openingBalance: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : num;
      }),
    supplierGroup: nullableString(100),
    notes: nullableString(1000),
    isActive: z.boolean().optional(),
  })
  .transform((data) => {
    const res: Record<string, any> = {};

    if (data.name !== undefined) res.name = data.name;
    if (data.gstin !== undefined) res.gstin = data.gstin;
    if (data.pan !== undefined) res.pan = data.pan;

    const mobile = data.mobileNumber ?? data.mobile;
    if (mobile !== undefined) res.mobileNumber = mobile;

    if (data.email !== undefined) res.email = data.email;
    if (data.address !== undefined) res.address = data.address;
    if (data.state !== undefined) res.state = data.state;
    if (data.creditTerms !== undefined) res.creditTerms = data.creditTerms;
    if (data.openingBalance !== undefined) res.openingBalance = data.openingBalance;
    if (data.supplierGroup !== undefined) res.supplierGroup = data.supplierGroup;
    if (data.notes !== undefined) res.notes = data.notes;
    if (data.isActive !== undefined) res.isActive = data.isActive;

    // Auto-update PAN & State if GSTIN changed
    if (data.gstin && data.gstin.length === 15) {
      const gstinStateCode = data.gstin.substring(0, 2);
      if (!res.state && GST_STATE_CODES[gstinStateCode]) {
        res.state = GST_STATE_CODES[gstinStateCode];
      }
      if (!res.pan) res.pan = data.gstin.substring(2, 12);
    }

    return res;
  });

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

/**
 * Query schema for searching, filtering, and paginating suppliers
 */
export const supplierQuerySchema = z.object({
  search: z.string().trim().optional(),
  supplierGroup: z.string().trim().optional(),
  isRegistered: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return undefined;
      if (typeof val === "boolean") return val;
      if (val === "true" || val === "1") return true;
      if (val === "false" || val === "0") return false;
      return undefined;
    }),
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
  state: z.string().trim().optional(),
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
    .enum(["name", "createdAt", "updatedAt", "openingBalance"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc", "ASC", "DESC"])
    .optional()
    .default("desc")
    .transform((val) => val.toLowerCase() as "asc" | "desc"),
});

export type SupplierQueryParams = z.infer<typeof supplierQuerySchema>;
