import { prisma } from "../../../../db/prisma";
import { StockMovementType } from "../../../../generated/prisma/enums";
import type {
  StockAdjustmentInput,
  StockMovementQueryParams,
} from "../validators/stock-valuation.validators";

export class StockValuationRepository {
  async resolveWarehouseId(businessId: string, warehouseId?: string | null) {
    // Ignore placeholder ids like "main" from frontend local models
    if (
      warehouseId &&
      warehouseId.trim().length > 0 &&
      warehouseId.trim().toLowerCase() !== "main"
    ) {
      const match = await prisma.warehouse.findFirst({
        where: { id: warehouseId.trim(), businessId, isActive: true },
        select: { id: true },
      });
      if (match) return match.id;
    }

    const defaultWh = await prisma.warehouse.findFirst({
      where: { businessId, isDefault: true, isActive: true },
      select: { id: true },
    });
    if (defaultWh) return defaultWh.id;

    const anyWh = await prisma.warehouse.findFirst({
      where: { businessId, isActive: true },
      select: { id: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (anyWh) return anyWh.id;

    // Auto-create Main Warehouse (same as purchase-bill ensureDefaultWarehouse)
    const created = await prisma.warehouse.create({
      data: {
        businessId,
        name: "Main Warehouse",
        isDefault: true,
        isActive: true,
      },
      select: { id: true },
    });
    return created.id;
  }

  async findProductsForValuation(businessId: string, warehouseId?: string) {
    const movementWhere: Record<string, unknown> = {};
    if (warehouseId) {
      movementWhere.warehouseId = warehouseId;
    }

    return prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        itemCode: true,
        sku: true,
        barcode: true,
        primaryUnit: true,
        category: true,
        warehouseId: true,
        purchasePrice: true,
        sellingPrice: true,
        openingStock: true,
        quantity: true,
        minStockLevel: true,
        isActive: true,
        warehouse: { select: { id: true, name: true } },
        stockMovements: {
          where: movementWhere,
          select: {
            quantity: true,
            warehouseId: true,
            unitCost: true,
            movementType: true,
          },
        },
      },
    });
  }

  async findStockMovements(businessId: string, params: StockMovementQueryParams) {
    const where: any = { businessId };

    if (params.warehouseId) where.warehouseId = params.warehouseId;
    if (params.productId) where.productId = params.productId;

    if (params.movementType) {
      const upper = params.movementType.trim().toUpperCase();
      if ((Object.values(StockMovementType) as string[]).includes(upper)) {
        where.movementType = upper as StockMovementType;
      }
    }

    if (params.fromDate || params.toDate) {
      where.movementDate = {};
      if (params.fromDate) {
        const from = new Date(params.fromDate);
        if (!Number.isNaN(from.getTime())) where.movementDate.gte = from;
      }
      if (params.toDate) {
        const to = new Date(params.toDate);
        if (!Number.isNaN(to.getTime())) where.movementDate.lte = to;
      }
    }

    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim();
      where.OR = [
        { product: { name: { contains: q, mode: "insensitive" } } },
        { product: { itemCode: { contains: q, mode: "insensitive" } } },
        { product: { sku: { contains: q, mode: "insensitive" } } },
        { referenceId: { contains: q, mode: "insensitive" } },
        { referenceType: { contains: q, mode: "insensitive" } },
        { batchNumber: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderField =
      params.sortBy === "quantity"
        ? "quantity"
        : params.sortBy === "createdAt"
          ? "createdAt"
          : "movementDate";

    return prisma.stockMovement.findMany({
      where,
      orderBy: { [orderField]: params.sortOrder },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            sku: true,
            primaryUnit: true,
          },
        },
        warehouse: { select: { id: true, name: true } },
      },
    });
  }

  async findProductById(businessId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true,
        name: true,
        purchasePrice: true,
        openingStock: true,
        quantity: true,
        warehouseId: true,
        primaryUnit: true,
      },
    });
  }

  async createStockAdjustment(
    businessId: string,
    warehouseId: string,
    input: StockAdjustmentInput
  ) {
    const movementDate = input.movementDate
      ? new Date(input.movementDate)
      : new Date();

    return prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          businessId,
          productId: input.productId,
          warehouseId,
          movementType: StockMovementType.STOCK_ADJUSTMENT,
          quantity: input.quantity,
          unitCost: input.unitCost ?? undefined,
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: input.reason.slice(0, 100),
          movementDate,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              sku: true,
              primaryUnit: true,
            },
          },
          warehouse: { select: { id: true, name: true } },
        },
      });

      await tx.product.update({
        where: { id: input.productId },
        data: { quantity: { increment: input.quantity } },
      });

      return movement;
    });
  }
}

export const stockValuationRepository = new StockValuationRepository();

