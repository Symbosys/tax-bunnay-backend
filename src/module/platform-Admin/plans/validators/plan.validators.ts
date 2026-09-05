import { z } from "zod";

/**
 * Validation schema for creating a SaaS subscription plan
 */
export const createPlanSchema = z.object({
  name: z
    .string({ error: "Plan name is required" })
    .trim()
    .min(1, "Plan name cannot be empty")
    .max(60, "Plan name cannot exceed 60 characters"),

  tagline: z
    .string()
    .trim()
    .max(250, "Tagline cannot exceed 250 characters")
    .optional()
    .default(""),

  priceMonthly: z
    .coerce
    .number({ error: "Monthly price is required" })
    .min(0, "Monthly price cannot be negative"),

  priceYearly: z
    .coerce
    .number()
    .min(0, "Yearly price cannot be negative")
    .optional(),

  maxUsers: z
    .coerce
    .number()
    .int()
    .positive("Max users must be at least 1")
    .optional()
    .default(10),

  maxInvoicesPerMonth: z
    .coerce
    .number()
    .int()
    .positive("Max invoices must be at least 1")
    .optional()
    .default(5000),

  storageLimitGb: z
    .coerce
    .number()
    .positive("Storage limit must be positive")
    .optional()
    .default(25.0),

  features: z
    .array(z.string().trim())
    .optional()
    .default([]),

  isPopular: z.boolean().optional().default(false),

  themeColor: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Theme color must be a valid hex code (e.g. #4F46E5)")
    .optional()
    .default("#4F46E5"),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

/**
 * Validation schema for updating a SaaS subscription plan
 */
export const updatePlanSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  tagline: z.string().trim().max(250).optional(),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  maxUsers: z.coerce.number().int().positive().optional(),
  maxInvoicesPerMonth: z.coerce.number().int().positive().optional(),
  storageLimitGb: z.coerce.number().positive().optional(),
  features: z.array(z.string().trim()).optional(),
  isPopular: z.boolean().optional(),
  themeColor: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional(),
});

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
