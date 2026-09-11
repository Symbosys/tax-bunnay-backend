import { z } from "zod";

export const stockValuationQuerySchema = z.object({
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  lowStockOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return false;
      if (typeof val === "boolean") return val;
      const normalized = val.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes";
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z
    .enum(["name", "currentStock", "purchasePrice", "stockValue", "minStockLevel", "itemCode"])
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const stockMovementQuerySchema = z.object({
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  movementType: z.string().trim().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sortBy: z.enum(["movementDate", "quantity", "createdAt"]).default("movementDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().trim().min(1, "Product ID is required"),
  quantity: z.coerce
    .number()
    .refine((v) => v !== 0, { message: "Adjustment quantity cannot be zero" }),
  reason: z.string().trim().min(1, "Reason is required").max(500),
  warehouseId: z.string().trim().optional(),
  unitCost: z.coerce.number().min(0).optional(),
  movementDate: z.string().optional(),
});

export type StockValuationQueryParams = z.infer<typeof stockValuationQuerySchema>;
export type StockMovementQueryParams = z.infer<typeof stockMovementQuerySchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
