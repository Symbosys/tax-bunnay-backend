import { z } from "zod";

export const registerDeviceTokenSchema = z.object({
  token: z.string().trim().min(1, "FCM Token cannot be empty"),
  deviceType: z.enum(["android", "ios", "web"]).default("android").optional(),
  userId: z.string().optional(),
  businessId: z.string().optional(),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

export const notificationTypeEnum = z.enum([
  "LOW_STOCK",
  "SUBSCRIPTION_EXPIRY",
  "SYSTEM_ALERT",
  "PAYMENT_DUE",
  "PAYMENT_RECEIVED",
  "INVOICE_GENERATED",
  "INVOICE_OVERDUE",
]);

export const notificationChannelEnum = z.enum([
  "IN_APP",
  "WHATSAPP",
  "EMAIL",
  "SMS",
]);

export const sendNotificationSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  message: z.string().trim().min(1, "Message is required"),
  type: notificationTypeEnum.default("SYSTEM_ALERT"),
  channel: notificationChannelEnum.default("IN_APP"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  token: z.string().optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export const notificationQuerySchema = z.object({
  isRead: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  type: z.string().optional(),
  page: z
    .preprocess((val) => (val !== undefined ? Number(val) : 1), z.number().int().min(1))
    .default(1),
  limit: z
    .preprocess((val) => (val !== undefined ? Number(val) : 20), z.number().int().min(1).max(100))
    .default(20),
});

export type NotificationQueryParams = z.infer<typeof notificationQuerySchema>;
