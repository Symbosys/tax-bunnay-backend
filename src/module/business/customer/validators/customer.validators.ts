import { z } from "zod";
import { PartyType } from "../../../../generated/prisma/enums";

/**
 * Standard Indian State Code Mapping for GSTIN & Address Resolution
 */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/**
 * Regex definitions
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const MOBILE_REGEX = /^[0-9+\s\-()]{7,20}$/;

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
 * Validator schema for creating a new Customer
 * Aligned with Flutter CustomerFormPage and Prisma Customer model
 */
export const createCustomerSchema = z
  .object({
    name: z
      .string({
        error: "Customer name is required",
      })
      .trim()
      .min(1, "Customer name is required")
      .max(150, "Customer name cannot exceed 150 characters"),

    // Customer Type / Category (Retail, Wholesale, Corporate, or PartyType)
    customerType: z
      .nativeEnum(PartyType)
      .optional()
      .default(PartyType.CUSTOMER),
    
    // UI field alias for type ('Retail', 'Wholesale', etc.)
    type: z.string().trim().max(50).optional().nullable(),

    // Registered GST customer flag
    isRegistered: z
      .boolean()
      .optional()
      .default(false),

    // GSTIN (15 characters)
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || GSTIN_REGEX.test(val),
        "Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)"
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
        "Invalid Indian PAN format (e.g. AAPFU0939F)"
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

    // Addresses
    billingAddress: nullableString(500),
    shippingAddress: nullableString(500),

    // State & State Code
    state: nullableString(100),
    stateCode: nullableString(10),

    // Credit terms
    creditLimit: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    
    creditPeriodDays: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    creditPeriod: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return isNaN(num) ? undefined : Math.max(0, num);
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

    // Grouping & Pricing
    customerGroup: nullableString(100),
    priceList: nullableString(100),
    notes: nullableString(1000),

    // Status
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    // Reconcile mobile / mobileNumber
    const finalMobile = data.mobileNumber ?? data.mobile ?? null;

    // Reconcile creditPeriod / creditPeriodDays
    const finalCreditPeriod = data.creditPeriod ?? data.creditPeriodDays ?? 0;

    // Reconcile customerGroup & type
    let finalCustomerGroup = data.customerGroup;
    if (!finalCustomerGroup && data.type) {
      finalCustomerGroup = data.type;
    }

    // Auto-sync isRegistered if valid GSTIN is present
    let finalIsRegistered = data.isRegistered;
    if (data.gstin && data.gstin.length === 15) {
      finalIsRegistered = true;
    }

    // Auto-extract state and PAN from GSTIN if missing
    let finalState = data.state;
    let finalStateCode = data.stateCode;
    let finalPan = data.pan;

    if (data.gstin && data.gstin.length === 15) {
      const gstinStateCode = data.gstin.substring(0, 2);
      if (!finalStateCode) {
        finalStateCode = gstinStateCode;
      }
      if (!finalState && GST_STATE_CODES[gstinStateCode]) {
        finalState = GST_STATE_CODES[gstinStateCode];
      }
      if (!finalPan) {
        finalPan = data.gstin.substring(2, 12);
      }
    }

    // Default shippingAddress to billingAddress if empty
    const finalShipping = data.shippingAddress || data.billingAddress || null;

    return {
      name: data.name,
      customerType: data.customerType,
      isRegistered: finalIsRegistered,
      gstin: data.gstin,
      pan: finalPan,
      mobileNumber: finalMobile,
      email: data.email,
      billingAddress: data.billingAddress,
      shippingAddress: finalShipping,
      state: finalState,
      stateCode: finalStateCode,
      creditLimit: data.creditLimit ?? 0,
      creditPeriodDays: finalCreditPeriod,
      openingBalance: data.openingBalance ?? 0,
      customerGroup: finalCustomerGroup,
      priceList: data.priceList,
      notes: data.notes,
      isActive: data.isActive,
    };
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Validator schema for updating an existing Customer
 */
export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    customerType: z.nativeEnum(PartyType).optional(),
    type: z.string().trim().max(50).optional().nullable(),
    isRegistered: z.boolean().optional(),
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
    billingAddress: nullableString(500),
    shippingAddress: nullableString(500),
    state: nullableString(100),
    stateCode: nullableString(10),
    creditLimit: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    creditPeriodDays: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return isNaN(num) ? 0 : Math.max(0, num);
      }),
    creditPeriod: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined) return undefined;
        if (val === "") return 0;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return isNaN(num) ? undefined : Math.max(0, num);
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
    customerGroup: nullableString(100),
    priceList: nullableString(100),
    notes: nullableString(1000),
    isActive: z.boolean().optional(),
  })
  .transform((data) => {
    const res: Record<string, any> = {};

    if (data.name !== undefined) res.name = data.name;
    if (data.customerType !== undefined) res.customerType = data.customerType;
    if (data.isRegistered !== undefined) res.isRegistered = data.isRegistered;
    if (data.gstin !== undefined) res.gstin = data.gstin;
    if (data.pan !== undefined) res.pan = data.pan;

    const mobile = data.mobileNumber ?? data.mobile;
    if (mobile !== undefined) res.mobileNumber = mobile;

    if (data.email !== undefined) res.email = data.email;
    if (data.billingAddress !== undefined) res.billingAddress = data.billingAddress;
    if (data.shippingAddress !== undefined) res.shippingAddress = data.shippingAddress;
    if (data.state !== undefined) res.state = data.state;
    if (data.stateCode !== undefined) res.stateCode = data.stateCode;
    if (data.creditLimit !== undefined) res.creditLimit = data.creditLimit;

    const creditPeriod = data.creditPeriod ?? data.creditPeriodDays;
    if (creditPeriod !== undefined) res.creditPeriodDays = creditPeriod;

    if (data.openingBalance !== undefined) res.openingBalance = data.openingBalance;

    const group = data.customerGroup ?? data.type;
    if (group !== undefined) res.customerGroup = group;

    if (data.priceList !== undefined) res.priceList = data.priceList;
    if (data.notes !== undefined) res.notes = data.notes;
    if (data.isActive !== undefined) res.isActive = data.isActive;

    // Auto-update PAN & State if GSTIN changed
    if (data.gstin && data.gstin.length === 15) {
      res.isRegistered = true;
      const gstinStateCode = data.gstin.substring(0, 2);
      if (!res.stateCode) res.stateCode = gstinStateCode;
      if (!res.state && GST_STATE_CODES[gstinStateCode]) {
        res.state = GST_STATE_CODES[gstinStateCode];
      }
      if (!res.pan) res.pan = data.gstin.substring(2, 12);
    }

    return res;
  });

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/**
 * Query schema for searching, filtering, and paginating customers
 */
export const customerQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.string().trim().optional(),
  customerGroup: z.string().trim().optional(),
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
    .enum(["name", "createdAt", "updatedAt", "openingBalance", "creditLimit"])
    .optional()
    .default("createdAt"),
  sortOrder: z
    .enum(["asc", "desc", "ASC", "DESC"])
    .optional()
    .default("desc")
    .transform((val) => val.toLowerCase() as "asc" | "desc"),
});

export type CustomerQueryParams = z.infer<typeof customerQuerySchema>;
