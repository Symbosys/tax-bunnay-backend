import { z } from "zod";

/**
 * Valid SaaS plan names supported on the platform
 */
export const SaaSPlanEnum = z.enum(["Starter", "Growth", "Enterprise"]);
export type SaaSPlan = z.infer<typeof SaaSPlanEnum>;

/**
 * Tenant lifecycle statuses mapped to Flutter UI
 */
export const TenantStatusEnum = z.enum(["active", "trial", "suspended", "pending"]);
export type TenantStatusType = z.infer<typeof TenantStatusEnum>;

/**
 * Schema for creating a new Organization Tenant from Platform Admin
 */
export const createPlatformOrganizationSchema = z.object({
  name: z
    .string({ error: "Organization name is required" })
    .trim()
    .min(1, "Organization name cannot be empty")
    .max(150, "Organization name cannot exceed 150 characters"),

  code: z
    .string({ error: "Tenant code is required" })
    .trim()
    .toUpperCase()
    .min(2, "Code must have at least 2 characters")
    .max(10, "Code cannot exceed 10 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must contain only alphanumeric characters, underscores or hyphens"),

  domain: z
    .string({ error: "Subdomain or domain URL is required" })
    .trim()
    .toLowerCase()
    .min(3, "Domain is too short"),

  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid 15-character GSTIN format (e.g., 27AABCU9603R1ZM)"
    )
    .optional()
    .nullable()
    .or(z.literal("")),

  contactPerson: z
    .string({ error: "Primary admin / contact person is required" })
    .trim()
    .min(1, "Contact person name is required")
    .max(120),

  contactEmail: z
    .string({ error: "Admin email is required" })
    .trim()
    .toLowerCase()
    .email("A valid admin email address is required"),

  contactPhone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("")),

  planName: SaaSPlanEnum.default("Growth"),

  status: TenantStatusEnum.default("active"),

  maxUsersLimit: z
    .coerce
    .number()
    .int()
    .positive("Max users limit must be positive")
    .optional()
    .default(15),

  storageLimitGb: z
    .coerce
    .number()
    .positive("Storage limit must be positive")
    .optional()
    .default(25.0),

  password: z
    .string()
    .min(6, "Initial password must be at least 6 characters")
    .optional(),
});

export type CreatePlatformOrganizationInput = z.infer<typeof createPlatformOrganizationSchema>;

/**
 * Schema for editing an existing Organization Tenant
 */
export const updatePlatformOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  domain: z.string().trim().toLowerCase().min(3).optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format"
    )
    .optional()
    .nullable()
    .or(z.literal("")),
  contactPerson: z.string().trim().min(1).max(120).optional(),
  contactEmail: z.string().trim().toLowerCase().email().optional(),
  contactPhone: z.string().trim().optional().nullable().or(z.literal("")),
  planName: SaaSPlanEnum.optional(),
  status: TenantStatusEnum.optional(),
  maxUsersLimit: z.coerce.number().int().positive().optional(),
  storageLimitGb: z.coerce.number().positive().optional(),
});

export type UpdatePlatformOrganizationInput = z.infer<typeof updatePlatformOrganizationSchema>;

/**
 * Query schema for searching, filtering, and paging through tenants
 */
export const platformOrganizationQuerySchema = z.object({
  search: z.string().optional().default(""),
  status: z.enum(["All", "Active", "Trial", "Suspended", "Pending"]).optional().default("All"),
  plan: z.enum(["All", "Starter", "Growth", "Enterprise"]).optional().default("All"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sortBy: z.enum(["createdAt", "businessName", "monthlySpend"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PlatformOrganizationQueryInput = z.infer<typeof platformOrganizationQuerySchema>;

/**
 * Schema for quick status toggles (e.g. active, suspended, trial)
 */
export const togglePlatformOrganizationStatusSchema = z.object({
  status: TenantStatusEnum,
});

export type TogglePlatformOrganizationStatusInput = z.infer<
  typeof togglePlatformOrganizationStatusSchema
>;
