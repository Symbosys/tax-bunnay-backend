import { z } from "zod";

export const subscribePlanSchema = z.object({
  planId: z.string().trim().min(1, "Plan ID cannot be empty"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  paymentGateway: z.string().optional(),
  gatewayPaymentId: z.string().optional(),
});

export type SubscribePlanInput = z.infer<typeof subscribePlanSchema>;
