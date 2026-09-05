import { z } from "zod";

/**
 * Validation schema for User / Platform Admin Registration
 */
export const registerSchema = z.object({
  fullName: z
    .string({
      error: "Full name is required",
    })
    .trim()
    .min(2, "Full name must be at least 2 characters long")
    .max(100, "Full name cannot exceed 100 characters"),

  email: z
    .string({
      error: "Email address is required",
    })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),

  password: z
    .string({
      error: "Password is required",
    })
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password cannot exceed 128 characters"),

  phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s-]{7,20}$/, "Please enter a valid phone number")
    .optional()
    .nullable()
    .or(z.literal("")),

  isPlatformAdmin: z.boolean().optional().default(false),
});

/**
 * Validation schema for User / Platform Admin Login
 */
export const loginSchema = z.object({
  email: z
    .string({
      error: "Email address is required",
    })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),

  password: z
    .string({
      error: "Password is required",
    })
    .min(1, "Password cannot be empty"),

  platform: z
    .enum(["WEB", "DESKTOP", "ANDROID", "IOS"], {
      error: "Platform must be WEB, DESKTOP, ANDROID, or IOS",
    })
    .optional()
    .default("WEB"),

  deviceInfo: z.string().trim().optional(),

  isPlatformAdminPortal: z.boolean().optional().default(false),
});

/**
 * Validation schema for Refresh Token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({
      error: "Refresh token is required",
    })
    .min(1, "Refresh token cannot be empty"),
});

/**
 * Validation schema for Password Reset / Change
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string({
      error: "Current password is required",
    })
    .min(1, "Current password is required"),

  newPassword: z
    .string({
      error: "New password is required",
    })
    .min(6, "New password must be at least 6 characters long")
    .max(128, "New password cannot exceed 128 characters"),
});

/**
 * Validation schema for Updating Profile
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters long")
    .max(100, "Full name cannot exceed 100 characters")
    .optional(),

  phone: z
    .string()
    .trim()
    .regex(/^[+0-9\s-]{7,20}$/, "Please enter a valid phone number")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
