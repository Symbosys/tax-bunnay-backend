import { z } from "zod";

export const warehouseQuerySchema = z.object({
  search: z.string().trim().optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null) return false;
      if (typeof val === "boolean") return val;
      const normalized = val.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "yes";
    }),
});

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, "Warehouse name is required").max(200),
  code: z.string().trim().max(50).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  contact: z.string().trim().max(50).optional().default(""),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  code: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(50).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const transferQuerySchema = z.object({
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createStockTransferSchema = z
  .object({
    fromWarehouseId: z.string().trim().min(1, "Source warehouse is required"),
    toWarehouseId: z.string().trim().min(1, "Destination warehouse is required"),
    referenceNumber: z
      .string()
      .trim()
      .min(1, "Reference / challan number is required")
      .max(100),
    notes: z.string().trim().max(1000).optional().default(""),
    transferDate: z.string().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1, "Product ID is required"),
          quantity: z.coerce
            .number()
            .positive("Transfer quantity must be greater than zero"),
        })
      )
      .min(1, "At least one transfer item is required"),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Source and destination warehouses must be different",
    path: ["toWarehouseId"],
  });

export type WarehouseQueryParams = z.infer<typeof warehouseQuerySchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type TransferQueryParams = z.infer<typeof transferQuerySchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
