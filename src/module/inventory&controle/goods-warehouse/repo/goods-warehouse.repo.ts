import { prisma } from "../../../../db/prisma";
import { StockMovementType } from "../../../../generated/prisma/enums";
import type {
  CreateStockTransferInput,
  CreateWarehouseInput,
  TransferQueryParams,
  UpdateWarehouseInput,
  WarehouseQueryParams,
} from "../validators/goods-warehouse.validators";

type WarehouseMeta = {
  address: string;
  code: string;
  contact: string;
};

export class GoodsWarehouseRepository {
  packWarehouseAddress(input: {
    address?: string;
    code?: string;
    contact?: string;
  }): string {
    return JSON.stringify({
      address: input.address ?? "",
      code: input.code ?? "",
      contact: input.contact ?? "",
    });
  }

  unpackWarehouseAddress(raw?: string | null): WarehouseMeta {
    if (!raw || !raw.trim()) {
      return { address: "", code: "", contact: "" };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (
          "address" in parsed ||
          "code" in parsed ||
          "contact" in parsed
        ) {
          return {
            address: String(parsed.address ?? ""),
            code: String(parsed.code ?? ""),
            contact: String(parsed.contact ?? ""),
          };
        }
      }
    } catch {
      // plain-text address from older rows
    }
    return { address: raw, code: "", contact: "" };
  }

  packTransferNotes(input: {
    notes?: string;
    referenceNumber: string;
  }): string {
    return JSON.stringify({
      notes: input.notes ?? "",
      referenceNumber: input.referenceNumber,
      status: "CONFIRMED",
    });
  }

  unpackTransferNotes(raw?: string | null): {
    notes: string;
    referenceNumber: string;
  } {
    if (!raw || !raw.trim()) {
      return { notes: "", referenceNumber: "" };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if ("referenceNumber" in parsed || "notes" in parsed) {
          return {
            notes: String(parsed.notes ?? ""),
            referenceNumber: String(parsed.referenceNumber ?? ""),
          };
        }
      }
    } catch {
      // plain-text notes from older rows
    }
    return { notes: raw, referenceNumber: "" };
  }

  async findWarehouses(businessId: string, params: WarehouseQueryParams) {
    const where: Record<string, unknown> = { businessId };
    if (!params.includeInactive) where.isActive = true;

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }

    return prisma.warehouse.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async findWarehouseById(businessId: string, warehouseId: string) {
    return prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId },
    });
  }

  async createWarehouse(businessId: string, input: CreateWarehouseInput) {
    const count = await prisma.warehouse.count({ where: { businessId } });
    const isDefault = input.isDefault || count === 0;
    const address = this.packWarehouseAddress(input);

    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.warehouse.updateMany({
          where: { businessId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.create({
        data: {
          businessId,
          name: input.name,
          address,
          isDefault,
          isActive: input.isActive,
        },
      });
    });
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: UpdateWarehouseInput,
    existingAddress: string | null
  ) {
    const currentMeta = this.unpackWarehouseAddress(existingAddress);
    const address = this.packWarehouseAddress({
      address: input.address ?? currentMeta.address,
      code: input.code ?? currentMeta.code,
      contact: input.contact ?? currentMeta.contact,
    });

    return prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.warehouse.updateMany({
          where: { businessId, isDefault: true, NOT: { id: warehouseId } },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id: warehouseId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          address,
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });
    });
  }

  async findProductsWithMovements(businessId: string) {
    return prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        itemCode: true,
        sku: true,
        primaryUnit: true,
        warehouseId: true,
        openingStock: true,
        quantity: true,
        purchasePrice: true,
        isActive: true,
        warehouse: { select: { id: true, name: true } },
        stockMovements: {
          select: {
            quantity: true,
            warehouseId: true,
          },
        },
      },
    });
  }

  async findProductById(businessId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true,
        name: true,
        itemCode: true,
        purchasePrice: true,
        openingStock: true,
        warehouseId: true,
        isActive: true,
        stockMovements: {
          select: {
            quantity: true,
            warehouseId: true,
          },
        },
      },
    });
  }

  async findTransfers(businessId: string, params: TransferQueryParams) {
    const where: any = { businessId };

    if (params.warehouseId) {
      where.OR = [
        { fromWarehouseId: params.warehouseId },
        { toWarehouseId: params.warehouseId },
      ];
    }

    if (params.fromDate || params.toDate) {
      where.transferDate = {};
      if (params.fromDate) {
        const from = new Date(params.fromDate);
        if (!Number.isNaN(from.getTime())) where.transferDate.gte = from;
      }
      if (params.toDate) {
        const to = new Date(params.toDate);
        if (!Number.isNaN(to.getTime())) where.transferDate.lte = to;
      }
    }

    return prisma.stockTransfer.findMany({
      where,
      orderBy: { transferDate: "desc" },
      include: {
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  async createTransfer(
    businessId: string,
    input: CreateStockTransferInput,
    resolvedItems: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
    }>
  ) {
    const transferDate = input.transferDate
      ? new Date(input.transferDate)
      : new Date();
    const notes = this.packTransferNotes({
      notes: input.notes,
      referenceNumber: input.referenceNumber,
    });

    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          businessId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          transferDate,
          notes,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          items: true,
        },
      });

      for (const item of resolvedItems) {
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: input.fromWarehouseId,
            movementType: StockMovementType.STOCK_TRANSFER_OUT,
            quantity: -item.quantity,
            unitCost: item.unitCost,
            referenceType: "STOCK_TRANSFER",
            referenceId: transfer.id,
            movementDate: transferDate,
          },
        });

        await tx.stockMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: input.toWarehouseId,
            movementType: StockMovementType.STOCK_TRANSFER_IN,
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: "STOCK_TRANSFER",
            referenceId: transfer.id,
            movementDate: transferDate,
          },
        });
      }

      return transfer;
    });
  }
}

export const goodsWarehouseRepository = new GoodsWarehouseRepository();
