import { z } from "zod";

/**
 * Zod validation schema for complete Organization Onboarding
 */
export const onboardOrganizationSchema = z.object({
  // --- Step 1: Basic Company & Identity ---
  organizationName: z
    .string({
      error: "Organization / Business name is required",
    })
    .trim()
    .min(1, "Organization name is required")
    .max(150, "Organization name cannot exceed 150 characters"),

  legalName: z.string().trim().max(150).optional().nullable(),
  tradeName: z.string().trim().max(150).optional().nullable(),

  organizationType: z
    .string()
    .trim()
    .optional()
    .default("Private Limited Company"),

  businessNature: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),

  pan: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .or(z.literal("")),

  dateOfIncorporation: z
    .string()
    .trim()
    .optional()
    .nullable(),

  logoUrl: z.string().trim().optional().nullable(),

  // --- Step 2: Contact & Communications ---
  email: z
    .string({
      error: "Official organization email is required",
    })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),

  mobileNumber: z
    .string({
      error: "Mobile / Contact number is required",
    })
    .trim()
    .min(4, "Mobile number must be at least 4 digits")
    .max(25, "Mobile number cannot exceed 25 digits"),

  website: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),

  altPhone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),

  // --- Step 3: Address & Location ---
  addressLine1: z.string().trim().optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  pinCode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),

  businessAddress: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  shippingAddress: z.string().trim().optional().nullable(),

  // --- Step 4: Financial & Accounting Preferences ---
  currency: z.string().trim().optional().default("INR - Indian Rupee (₹)"),
  financialYearStart: z.string().trim().optional().nullable(),
  booksStartingDate: z.string().trim().optional().nullable(),

  isGstRegistered: z.boolean().optional().default(true),
  gstRegistrationType: z
    .string()
    .optional()
    .default("REGULAR"),

  // --- Step 5: Taxation & Compliance ---
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .or(z.literal("")),

  tan: z.string().trim().toUpperCase().optional().nullable().or(z.literal("")),
  cinOrLlpin: z.string().trim().toUpperCase().optional().nullable().or(z.literal("")),
  msmeNumber: z.string().trim().optional().nullable().or(z.literal("")),

  // --- Step 6: Store Admin / Owner Details ---
  adminName: z
    .string()
    .trim()
    .optional()
    .default("Store Admin"),

  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable(),

  password: z
    .string({
      error: "Master password is required",
    })
    .min(4, "Password must be at least 4 characters long")
    .max(128, "Password cannot exceed 128 characters"),

  adminRole: z.string().trim().optional().default("Store Owner / MD"),

  teamInvites: z
    .array(z.string().trim().toLowerCase())
    .optional()
    .default([])
    .or(
      z.string().transform((str) =>
        str
          ? str
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean)
          : []
      )
    ),

  // --- Step 7: SaaS Plan & Subscription ---
  planId: z.string().trim().optional().nullable(),
  planName: z.string().trim().optional().default("Growth"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"]).optional().default("MONTHLY"),
});

/**
 * GSTIN Validation Schema
 */
export const validateGstinSchema = z.object({
  gstin: z
    .string({
      error: "GSTIN is required",
    })
    .trim()
    .toUpperCase(),
});

/**
 * Check Name / Domain Availability Schema
 */
export const checkNameAvailabilitySchema = z.object({
  name: z
    .string({
      error: "Organization name is required",
    })
    .trim()
    .min(1, "Name must not be empty"),
});

export type OnboardOrganizationInput = z.infer<typeof onboardOrganizationSchema>;
export type ValidateGstinInput = z.infer<typeof validateGstinSchema>;
export type CheckNameAvailabilityInput = z.infer<typeof checkNameAvailabilitySchema>;
