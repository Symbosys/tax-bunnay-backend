import { prisma } from "../../../../db/prisma";
import { ErrorResponse } from "../../../../utils/response.util";
import { productRepo, ProductRepository } from "../repo/product.repo";
import type {
  CreateProductInput,
  ProductQueryParams,
  UpdateProductInput,
} from "../validators/product.validators";

export class ProductService {
  private repo: ProductRepository;

  constructor(repo: ProductRepository = productRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format product entity for frontend API & POS compatibility
   */
  private formatProduct(product: any) {
    const netMovements = (product.stockMovements ?? []).reduce(
      (acc: number, m: any) => acc + Number(m.quantity ?? 0),
      0
    );
    const opening = Number(product.openingStock ?? 0);
    const currentStock = Math.max(0, opening + netMovements);

    const sellingPrice = Number(product.sellingPrice ?? 0);
    const purchasePrice = Number(product.purchasePrice ?? 0);
    const mrp = Number(product.mrp ?? sellingPrice);
    const wholesalePrice = Number(product.wholesalePrice ?? sellingPrice);
    const gstRate = Number(product.gstRatePercent ?? 0);
    const minStock = Number(product.minStockLevel ?? 0);
    const code = product.itemCode ?? "";

    // Category styling helper
    const category = product.category ?? "General";
    const badgeColors = this.getCategoryBadgeColors(category);

    return {
      id: product.id,
      businessId: product.businessId,
      name: product.name,
      code: code,
      itemCode: code,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      hsnCode: product.hsnCode ?? "",
      primaryUnit: product.primaryUnit ?? "PCS",
      secondaryUnit: product.secondaryUnit ?? "",
      unit: product.primaryUnit ?? "PCS",
      gstRate: gstRate,
      gstRatePercent: gstRate,
      purchasePrice: purchasePrice,
      sellingPrice: sellingPrice,
      mrp: mrp,
      wholesalePrice: wholesalePrice,
      minStockLevel: minStock,
      openingStock: opening,
      currentStock: currentStock,
      stock: Math.round(currentStock),
      category: category,
      subCategory: product.subCategory ?? "",
      brand: product.brand ?? "",
      warehouseId: product.warehouseId ?? "",
      warehouseName: product.warehouse?.name ?? "",
      rackOrBin: product.rackOrBin ?? "",
      supplierId: product.supplierId ?? product.supplier?.id ?? "",
      supplierName: product.supplier?.name ?? "",
      supplier: product.supplier
        ? {
            id: product.supplier.id,
            name: product.supplier.name,
            gstin: product.supplier.gstin ?? "",
            mobile: product.supplier.mobileNumber ?? "",
          }
        : null,
      hasBatchTracking: Boolean(product.hasBatchTracking),
      hasSerialTracking: Boolean(product.hasSerialTracking),
      hasExpiryTracking: Boolean(product.hasExpiryTracking),
      isActive: Boolean(product.isActive),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      // UI badge metadata for Flutter catalogue
      categoryBadgeBg: badgeColors.bg,
      categoryBadgeText: badgeColors.text,
      isLowStock: minStock > 0 && currentStock <= minStock,
      _count: product._count,
    };
  }

  /**
   * Determine harmonious category badge colors for frontend presentation
   */
  private getCategoryBadgeColors(category: string): {
    bg: string;
    text: string;
  } {
    const c = category.toLowerCase();
    if (c.includes("dairy")) return { bg: "#E0F2FE", text: "#0284C7" };
    if (c.includes("snack") || c.includes("food"))
      return { bg: "#FFEDD5", text: "#EA580C" };
    if (c.includes("biscuit") || c.includes("bakery"))
      return { bg: "#F3E8FF", text: "#9333EA" };
    if (c.includes("beverage") || c.includes("drink"))
      return { bg: "#DCFCE7", text: "#16A34A" };
    if (c.includes("home") || c.includes("clean"))
      return { bg: "#CCFBF1", text: "#0D9488" };
    if (c.includes("personal") || c.includes("care") || c.includes("soap"))
      return { bg: "#FCE7F3", text: "#DB2777" };
    if (c.includes("grocer")) return { bg: "#FEF3C7", text: "#D97706" };
    return { bg: "#F1F5F9", text: "#475569" };
  }

  /**
   * Validate business existence and accessibility
   */
  private async validateBusiness(businessId: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse(
        "Business ID is required. Please select or switch an active business.",
        400
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, businessName: true, isActive: true },
    });

    if (!business) {
      throw new ErrorResponse("Target organization/business not found.", 404);
    }

    if (!business.isActive) {
      throw new ErrorResponse(
        "Target organization is currently inactive. Please contact your administrator.",
        403
      );
    }

    return business;
  }

  /**
   * Ensure supplier exists in this business before linking
   */
  private async validateSupplier(businessId: string, supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
      select: { id: true, isActive: true, name: true },
    });

    if (!supplier) {
      throw new ErrorResponse(
        "Supplier not found in this organization. Create the supplier first.",
        404
      );
    }

    return supplier;
  }

  /**
   * Create a new Product under Business Master
   */
  async createProduct(businessId: string, input: CreateProductInput) {
    await this.validateBusiness(businessId);

    // Auto-generate item code if omitted
    let finalCode = input.itemCode;
    if (!finalCode || finalCode.trim().length === 0) {
      finalCode = `PRD-${Date.now().toString().slice(-6)}`;
    }

    // Duplicate check for itemCode within the same business
    const existingWithCode = await this.repo.findByCodeOrSku(
      businessId,
      finalCode
    );
    if (existingWithCode) {
      throw new ErrorResponse(
        `A product with reference code/SKU "${finalCode}" already exists (${existingWithCode.name}).`,
        409
      );
    }

    // Duplicate check for barcode if provided
    if (input.barcode && input.barcode.trim().length > 0) {
      const existingBarcode = await this.repo.findByBarcode(
        businessId,
        input.barcode.trim()
      );
      if (existingBarcode) {
        throw new ErrorResponse(
          `A product with barcode "${input.barcode.trim()}" already exists (${existingBarcode.name}).`,
          409
        );
      }
    }

    if (input.supplierId) {
      await this.validateSupplier(businessId, input.supplierId);
    }

    const productData = {
      ...input,
      itemCode: finalCode,
    };

    const product = await this.repo.create(businessId, productData);
    return this.formatProduct(product);
  }

  /**
   * Search, filter, and paginate products directory
   */
  async getProducts(businessId: string, query: ProductQueryParams) {
    await this.validateBusiness(businessId);

    const result = await this.repo.findAll(businessId, query);
    const formattedList = result.products.map((p: any) =>
      this.formatProduct(p)
    );

    return {
      products: formattedList,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    };
  }

  /**
   * Get single product by ID
   */
  async getProductById(businessId: string, productId: string) {
    await this.validateBusiness(businessId);

    const product = await this.repo.findById(businessId, productId);
    if (!product) {
      throw new ErrorResponse(
        "Product item not found in this organization.",
        404
      );
    }

    return {
      ...this.formatProduct(product),
      usageStatistics: {
        invoicedCount: (product as any)._count?.invoiceItems ?? 0,
        purchasedCount: (product as any)._count?.purchaseItems ?? 0,
        stockMovementsCount: (product as any)._count?.stockMovements ?? 0,
      },
    };
  }

  /**
   * High-speed Barcode lookup for Product Listing / POS.
   * Does NOT auto-create products — unit price & GST must be entered manually
   * via the Product Listing screen before a product is saved to the database.
   */
  async findProductByBarcode(businessId: string, barcodeOrSku: string) {
    await this.validateBusiness(businessId);

    if (!barcodeOrSku || barcodeOrSku.trim().length === 0) {
      throw new ErrorResponse("Barcode or SKU code is required to scan.", 400);
    }

    const clean = barcodeOrSku.trim();
    const product = await this.repo.findByBarcode(businessId, clean);

    if (!product) {
      throw new ErrorResponse(
        `Product with barcode "${clean}" is not listed yet. Add it from Product Listing with unit price and GST.`,
        404
      );
    }

    return this.formatProduct(product);
  }

  /**
   * Update existing product
   */
  async updateProduct(
    businessId: string,
    productId: string,
    input: UpdateProductInput
  ) {
    await this.validateBusiness(businessId);

    // Verify product exists
    const existing = await this.repo.findById(businessId, productId);
    if (!existing) {
      throw new ErrorResponse("Product not found to update.", 404);
    }

    // Duplicate code check if code is changing
    if (input.itemCode && input.itemCode !== existing.itemCode) {
      const duplicateCode = await this.repo.findByCodeOrSku(
        businessId,
        input.itemCode,
        productId
      );
      if (duplicateCode) {
        throw new ErrorResponse(
          `Another product with code "${input.itemCode}" already exists (${duplicateCode.name}).`,
          409
        );
      }
    }

    // Duplicate barcode check if barcode is changing
    if (
      input.barcode &&
      input.barcode.trim().length > 0 &&
      input.barcode !== existing.barcode
    ) {
      const duplicateBarcode = await this.repo.findByBarcode(
        businessId,
        input.barcode.trim()
      );
      if (duplicateBarcode && duplicateBarcode.id !== productId) {
        throw new ErrorResponse(
          `Another product with barcode "${input.barcode}" already exists (${duplicateBarcode.name}).`,
          409
        );
      }
    }

    if (input.supplierId) {
      await this.validateSupplier(businessId, input.supplierId);
    }

    const updated = await this.repo.update(businessId, productId, input);
    return this.formatProduct(updated);
  }

  /**
   * Delete or soft-delete product
   * If product has transaction references, soft deletes (isActive: false)
   * If never referenced, performs permanent database deletion
   */
  async deleteProduct(businessId: string, productId: string) {
    await this.validateBusiness(businessId);

    const existing = await this.repo.findById(businessId, productId);
    if (!existing) {
      throw new ErrorResponse("Product not found to delete.", 404);
    }

    const transactionCount = await this.repo.countTransactions(
      businessId,
      productId
    );

    if (transactionCount > 0) {
      await this.repo.softDelete(businessId, productId);
      return {
        isSoftDeleted: true,
        message: `Product "${existing.name}" is referenced in ${transactionCount} transaction(s). Product has been safely deactivated to protect financial and stock ledgers.`,
      };
    }

    await this.repo.delete(businessId, productId);
    return {
      isSoftDeleted: false,
      message: `Product "${existing.name}" deleted successfully.`,
    };
  }

  /**
   * Aggregate metrics for product directory
   */
  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }
}

export const productService = new ProductService();
