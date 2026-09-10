import { z } from "zod";

/**
 * Regex for Indian Harmonized System of Nomenclature (HSN) code
 * Typically 2, 4, 6, or 8 digits
 */
export const HSN_CODE_REGEX = /^[0-9]{2,8}$/;

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
 * Helper to parse and coerce numeric fields (numbers or string decimals)
 */
const coerceNumber = (defaultValue = 0, minVal = 0) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .default(defaultValue)
    .transform((val) => {
      if (val === null || val === undefined || val === "") return defaultValue;
      const num = typeof val === "string" ? parseFloat(val) : Number(val);
      return isNaN(num) ? defaultValue : Math.max(minVal, num);
    });

/**
 * Validator schema for creating a new Product
 * Aligned with product.prisma, Flutter ProductFormPage, and POS Billing requirements
 */
export const createProductSchema = z
  .object({
    name: z
      .string({
        error: "Product name is required",
      })
      .trim()
      .min(1, "Product name is required")
      .max(255, "Product name cannot exceed 255 characters"),

    // Product item code / reference code (accepts itemCode or code)
    itemCode: nullableString(50),
    code: nullableString(50),

    // SKU (Stock Keeping Unit)
    sku: nullableString(50),

    // Barcode (EAN-13, EAN-8, UPC, Code-128, etc.)
    barcode: nullableString(100),

    // HSN Tax Code
    hsnCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || HSN_CODE_REGEX.test(val),
        "HSN Code must be numeric (2 to 8 digits, e.g. 8471, 0401)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    // Units of Measurement
    primaryUnit: z
      .string()
      .trim()
      .default("PCS")
      .transform((val) => (val === "" || !val ? "PCS" : val.toUpperCase())),
    secondaryUnit: nullableString(20),

    // GST Tax Rate (percentage, e.g. 0, 5, 12, 18, 28)
    gstRatePercent: coerceNumber(0),
    gstRate: coerceNumber(0),

    // Pricing Structure
    purchasePrice: coerceNumber(0),
    sellingPrice: coerceNumber(0),
    mrp: coerceNumber(0),
    wholesalePrice: coerceNumber(0),

    // Inventory Stock Control
    minStockLevel: coerceNumber(0),
    openingStock: coerceNumber(0),
    quantity: coerceNumber(0),
    stock: coerceNumber(0),

    // Advanced Tracking Flags
    hasBatchTracking: z.boolean().optional().default(false),
    hasSerialTracking: z.boolean().optional().default(false),
    hasExpiryTracking: z.boolean().optional().default(false),

    // Warehouse & Location
    warehouseId: nullableString(100),
    rackOrBin: nullableString(50),

    // Default supplier for this product (optional)
    supplierId: nullableString(100),

    // Taxonomy & Variants
    category: nullableString(100),
    subCategory: nullableString(100),
    subcategory: nullableString(100),
    variant: nullableString(100),
    brand: nullableString(100),

    // Image URL & base64
    imageUrl: nullableString(1000),
    imageBase64: z.string().optional().nullable(),

    // Status
    isActive: z.boolean().optional().default(true),
  })
  .transform((data) => {
    // Reconcile aliases: code -> itemCode, gstRate -> gstRatePercent
    const finalItemCode = data.itemCode ?? data.code;
    const finalGstRate =
      data.gstRatePercent > 0 ? data.gstRatePercent : data.gstRate;
    const finalOpeningStock =
      data.openingStock > 0
        ? data.openingStock
        : (data.quantity > 0 ? data.quantity : data.stock);
    const finalSubCategory = data.subCategory ?? data.subcategory ?? null;

    return {
      name: data.name,
      itemCode: finalItemCode,
      sku: data.sku,
      barcode: data.barcode,
      hsnCode: data.hsnCode,
      primaryUnit: data.primaryUnit,
      secondaryUnit: data.secondaryUnit,
      gstRatePercent: finalGstRate,
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      mrp: data.mrp,
      wholesalePrice: data.wholesalePrice,
      minStockLevel: data.minStockLevel,
      openingStock: finalOpeningStock,
      quantity: finalOpeningStock,
      hasBatchTracking: data.hasBatchTracking,
      hasSerialTracking: data.hasSerialTracking,
      hasExpiryTracking: data.hasExpiryTracking,
      warehouseId: data.warehouseId,
      rackOrBin: data.rackOrBin,
      supplierId: data.supplierId,
      category: data.category ?? "General",
      subCategory: finalSubCategory,
      variant: data.variant ?? null,
      brand: data.brand,
      imageUrl: data.imageUrl || null,
      isActive: data.isActive,
    };
  });

/**
 * Validator schema for updating an existing Product
 */
export const updateProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Product name cannot be empty")
      .max(255)
      .optional(),

    itemCode: nullableString(50),
    code: nullableString(50),
    sku: nullableString(50),
    barcode: nullableString(100),

    hsnCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || val === "" || HSN_CODE_REGEX.test(val),
        "HSN Code must be numeric (2 to 8 digits)"
      )
      .transform((val) => (val === "" || val === undefined ? null : val)),

    primaryUnit: z.string().trim().optional(),
    secondaryUnit: nullableString(20),

    gstRatePercent: z.union([z.number(), z.string()]).optional(),
    gstRate: z.union([z.number(), z.string()]).optional(),

    purchasePrice: z.union([z.number(), z.string()]).optional(),
    sellingPrice: z.union([z.number(), z.string()]).optional(),
    mrp: z.union([z.number(), z.string()]).optional(),
    wholesalePrice: z.union([z.number(), z.string()]).optional(),

    minStockLevel: z.union([z.number(), z.string()]).optional(),
    openingStock: z.union([z.number(), z.string()]).optional(),
    quantity: z.union([z.number(), z.string()]).optional(),
    stock: z.union([z.number(), z.string()]).optional(),

    hasBatchTracking: z.boolean().optional(),
    hasSerialTracking: z.boolean().optional(),
    hasExpiryTracking: z.boolean().optional(),

    warehouseId: nullableString(100),
    rackOrBin: nullableString(50),
    supplierId: nullableString(100),

    category: nullableString(100),
    subCategory: nullableString(100),
    subcategory: nullableString(100),
    variant: nullableString(100),
    brand: nullableString(100),

    imageUrl: nullableString(1000),
    imageBase64: z.string().optional().nullable(),

    isActive: z.boolean().optional(),
  })
  .transform((data) => {
    const parseNumber = (val: any) => {
      if (val === undefined) return undefined;
      if (val === null || val === "") return 0;
      const n = typeof val === "string" ? parseFloat(val) : Number(val);
      return isNaN(n) ? 0 : Math.max(0, n);
    };

    const finalItemCode = data.itemCode ?? data.code;
    const gstVal =
      data.gstRatePercent !== undefined ? data.gstRatePercent : data.gstRate;
    const stockVal = data.openingStock ?? data.quantity ?? data.stock;
    const subCatVal = data.subCategory ?? data.subcategory;

    return {
      ...(data.name !== undefined && { name: data.name }),
      ...(finalItemCode !== undefined && { itemCode: finalItemCode }),
      ...(data.sku !== undefined && { sku: data.sku }),
      ...(data.barcode !== undefined && { barcode: data.barcode }),
      ...(data.hsnCode !== undefined && { hsnCode: data.hsnCode }),
      ...(data.primaryUnit !== undefined && {
        primaryUnit: data.primaryUnit.toUpperCase(),
      }),
      ...(data.secondaryUnit !== undefined && {
        secondaryUnit: data.secondaryUnit,
      }),
      ...(gstVal !== undefined && { gstRatePercent: parseNumber(gstVal) }),
      ...(data.purchasePrice !== undefined && {
        purchasePrice: parseNumber(data.purchasePrice),
      }),
      ...(data.sellingPrice !== undefined && {
        sellingPrice: parseNumber(data.sellingPrice),
      }),
      ...(data.mrp !== undefined && { mrp: parseNumber(data.mrp) }),
      ...(data.wholesalePrice !== undefined && {
        wholesalePrice: parseNumber(data.wholesalePrice),
      }),
      ...(data.minStockLevel !== undefined && {
        minStockLevel: parseNumber(data.minStockLevel),
      }),
      ...(stockVal !== undefined && {
        openingStock: parseNumber(stockVal),
        quantity: parseNumber(stockVal),
      }),
      ...(data.hasBatchTracking !== undefined && {
        hasBatchTracking: data.hasBatchTracking,
      }),
      ...(data.hasSerialTracking !== undefined && {
        hasSerialTracking: data.hasSerialTracking,
      }),
      ...(data.hasExpiryTracking !== undefined && {
        hasExpiryTracking: data.hasExpiryTracking,
      }),
      ...(data.warehouseId !== undefined && { warehouseId: data.warehouseId }),
      ...(data.rackOrBin !== undefined && { rackOrBin: data.rackOrBin }),
      ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
      ...(data.category !== undefined && { category: data.category }),
      ...(subCatVal !== undefined && { subCategory: subCatVal }),
      ...(data.variant !== undefined && { variant: data.variant }),
      ...(data.brand !== undefined && { brand: data.brand }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
  });

/**
 * Validator schema for querying / filtering products directory
 */
export const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  category: z.string().trim().optional(),
  subCategory: z.string().trim().optional(),
  variant: z.string().trim().optional(),
  lowStock: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === "true" || val === "1"),
  barcode: z.string().trim().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return true;
      return val === true || val === "true" || val === "1";
    }),
  page: z
    .union([z.number(), z.string()])
    .optional()
    .default(1)
    .transform((val) => {
      const p = typeof val === "string" ? parseInt(val, 10) : Number(val);
      return isNaN(p) || p < 1 ? 1 : p;
    }),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .default(20)
    .transform((val) => {
      const l = typeof val === "string" ? parseInt(val, 10) : Number(val);
      return isNaN(l) || l < 1 ? 20 : Math.min(l, 100);
    }),
  sortBy: z
    .enum(["createdAt", "name", "sellingPrice", "openingStock", "category"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
