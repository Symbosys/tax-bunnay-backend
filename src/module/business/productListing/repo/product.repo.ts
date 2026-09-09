import { prisma } from "../../../../db/prisma";
import type { ProductQueryParams } from "../validators/product.validators";

export class ProductRepository {
  /**
   * Helper to verify or sanitize warehouseId
   */
  private async resolveWarehouseId(
    businessId: string,
    warehouseId?: string | null
  ): Promise<string | null> {
    if (!warehouseId || warehouseId.trim().length === 0) return null;
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId.trim(), businessId },
      select: { id: true },
    });
    return wh ? wh.id : null;
  }

  /**
   * Create a new Product record linked to a Business
   */
  async create(businessId: string, data: any) {
    const { warehouseId, ...rest } = data;
    const resolvedWarehouseId = await this.resolveWarehouseId(
      businessId,
      warehouseId
    );

    return prisma.product.create({
      data: {
        businessId,
        ...rest,
        warehouseId: resolvedWarehouseId,
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            invoiceItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });
  }

  /**
   * Find product by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.product.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        stockMovements: {
          select: { quantity: true },
        },
        _count: {
          select: {
            invoiceItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });
  }

  /**
   * High-speed barcode / SKU lookup for POS Billing
   */
  async findByBarcode(businessId: string, barcodeOrSku: string) {
    const clean = barcodeOrSku.trim();
    return prisma.product.findFirst({
      where: {
        businessId,
        isActive: true, // POS only bills active products
        OR: [
          { barcode: { equals: clean, mode: "insensitive" } },
          { sku: { equals: clean, mode: "insensitive" } },
          { itemCode: { equals: clean, mode: "insensitive" } },
          { id: clean },
        ],
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        stockMovements: {
          select: { quantity: true },
        },
        _count: {
          select: {
            invoiceItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });
  }

  /**
   * Find existing product by code or SKU to prevent duplicate conflicts
   */
  async findByCodeOrSku(
    businessId: string,
    codeOrSku: string,
    excludeId?: string
  ) {
    const clean = codeOrSku.trim();
    return prisma.product.findFirst({
      where: {
        businessId,
        ...(excludeId && { id: { not: excludeId } }),
        OR: [
          { itemCode: { equals: clean, mode: "insensitive" } },
          { sku: { equals: clean, mode: "insensitive" } },
        ],
      },
    });
  }

  /**
   * Search, filter, and paginate products for Catalogue Directory & POS
   */
  async findAll(businessId: string, params: ProductQueryParams) {
    const {
      search,
      category,
      subCategory,
      lowStock,
      barcode,
      isActive,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: any = {
      businessId,
      // Default to returning active products only (deleted items never reappear)
      isActive: isActive !== undefined ? isActive : true,
    };

    // Category filter
    if (category && category.trim().length > 0 && category !== "All") {
      where.category = {
        equals: category.trim(),
        mode: "insensitive",
      };
    }

    if (subCategory && subCategory.trim().length > 0 && subCategory !== "All") {
      where.subCategory = {
        equals: subCategory.trim(),
        mode: "insensitive",
      };
    }

    // Exact Barcode filter if provided in query
    if (barcode && barcode.trim().length > 0) {
      where.barcode = barcode.trim();
    }

    // Search query across name, itemCode, barcode, and sku
    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { itemCode: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
      ];
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          warehouse: {
            select: { id: true, name: true },
          },
          stockMovements: {
            select: { quantity: true },
          },
          _count: {
            select: {
              invoiceItems: true,
              purchaseItems: true,
              stockMovements: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // If lowStock filter was requested, filter items where currentStock <= minStockLevel
    let finalProducts = products;
    if (lowStock) {
      finalProducts = products.filter((p) => {
        const netMovements = p.stockMovements.reduce(
          (acc, m) => acc + Number(m.quantity),
          0
        );
        const currentStock = Number(p.openingStock) + netMovements;
        const minLevel = Number(p.minStockLevel ?? 0);
        return currentStock <= minLevel;
      });
    }

    return {
      products: finalProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update Product record
   */
  async update(businessId: string, id: string, data: any) {
    const { warehouseId, ...rest } = data;
    const updateData: any = { ...rest };

    if (warehouseId !== undefined) {
      updateData.warehouseId = await this.resolveWarehouseId(
        businessId,
        warehouseId
      );
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        stockMovements: {
          select: { quantity: true },
        },
        _count: {
          select: {
            invoiceItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete Product (set isActive: false)
   */
  async softDelete(businessId: string, id: string) {
    return prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Hard delete Product
   */
  async delete(businessId: string, id: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Count total references across invoice items, purchase items, and stock movements
   */
  async countTransactions(businessId: string, id: string): Promise<number> {
    const product = await prisma.product.findFirst({
      where: { id, businessId },
      include: {
        _count: {
          select: {
            invoiceItems: true,
            purchaseItems: true,
            stockMovements: true,
          },
        },
      },
    });

    if (!product) return 0;
    return (
      (product._count?.invoiceItems ?? 0) +
      (product._count?.purchaseItems ?? 0) +
      (product._count?.stockMovements ?? 0)
    );
  }

  /**
   * Aggregate directory metrics for products
   */
  async getMetrics(businessId: string) {
    const [totalProducts, activeProducts, allProducts] = await Promise.all([
      prisma.product.count({ where: { businessId } }),
      prisma.product.count({ where: { businessId, isActive: true } }),
      prisma.product.findMany({
        where: { businessId, isActive: true },
        select: {
          openingStock: true,
          minStockLevel: true,
          sellingPrice: true,
          purchasePrice: true,
          category: true,
          stockMovements: {
            select: { quantity: true },
          },
        },
      }),
    ]);

    let lowStockCount = 0;
    let totalStockValue = 0;
    const categoriesSet = new Set<string>();

    for (const p of allProducts) {
      if (p.category && p.category.trim().length > 0) {
        categoriesSet.add(p.category.trim());
      }

      const netMovements = p.stockMovements.reduce(
        (acc, m) => acc + Number(m.quantity),
        0
      );
      const currentStock = Number(p.openingStock) + netMovements;
      const minLevel = Number(p.minStockLevel ?? 0);

      if (minLevel > 0 && currentStock <= minLevel) {
        lowStockCount++;
      }

      const unitVal = Number(p.sellingPrice ?? p.purchasePrice ?? 0);
      totalStockValue += Math.max(0, currentStock) * unitVal;
    }

    return {
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      lowStockCount,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      totalCategories: categoriesSet.size,
      categories: Array.from(categoriesSet),
    };
  }
}

export const productRepo = new ProductRepository();
