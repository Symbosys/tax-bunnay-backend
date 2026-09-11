import { ErrorResponse } from "../../../../utils/response.util";
import {
  goodsWarehouseRepository,
  GoodsWarehouseRepository,
} from "../repo/goods-warehouse.repo";
import type {
  StockTransferLog,
  WarehouseLocation,
  WarehouseProductStock,
} from "../types/goods-warehouse.types";
import type {
  CreateStockTransferInput,
  CreateWarehouseInput,
  TransferQueryParams,
  UpdateWarehouseInput,
  WarehouseQueryParams,
} from "../validators/goods-warehouse.validators";

export class GoodsWarehouseService {
  private repo: GoodsWarehouseRepository;

  constructor(repo: GoodsWarehouseRepository = goodsWarehouseRepository) {
    this.repo = repo;
  }

  private toWarehouseLocation(row: any): WarehouseLocation {
    const meta = this.repo.unpackWarehouseAddress(row.address);
    return {
      id: row.id,
      name: row.name,
      code: meta.code || this.fallbackCode(row.name, row.id),
      address: meta.address,
      contact: meta.contact,
      isDefault: Boolean(row.isDefault),
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private fallbackCode(name: string, id: string): string {
    const initials = String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4);
    return initials || String(id).slice(-4).toUpperCase();
  }

  private computeWarehouseStock(
    product: any,
    warehouseId: string,
    defaultWarehouseId?: string | null
  ): number {
    const homeId = product.warehouseId || defaultWarehouseId || null;
    const opening =
      homeId && homeId === warehouseId ? Number(product.openingStock ?? 0) : 0;
    const net = (product.stockMovements ?? [])
      .filter((m: any) => m.warehouseId === warehouseId)
      .reduce((acc: number, m: any) => acc + Number(m.quantity ?? 0), 0);
    return Number((opening + net).toFixed(3));
  }

  private toProductStock(
    product: any,
    warehouses: Array<{ id: string }>,
    defaultWarehouseId?: string | null
  ): WarehouseProductStock {
    const warehouseStocks: Record<string, number> = {};
    for (const wh of warehouses) {
      warehouseStocks[wh.id] = this.computeWarehouseStock(
        product,
        wh.id,
        defaultWarehouseId
      );
    }

    const homeId = product.warehouseId || defaultWarehouseId || null;
    const currentStock = homeId
      ? warehouseStocks[homeId] ?? 0
      : Number(product.quantity ?? product.openingStock ?? 0);

    return {
      productId: product.id,
      name: product.name,
      itemCode: product.itemCode ?? "",
      sku: product.sku ?? "",
      primaryUnit: product.primaryUnit ?? "PCS",
      warehouseId: product.warehouseId ?? product.warehouse?.id ?? null,
      warehouseName: product.warehouse?.name ?? null,
      openingStock: Number(product.openingStock ?? 0),
      currentStock: Number(currentStock.toFixed(3)),
      warehouseStocks,
      purchasePrice: Number(product.purchasePrice ?? 0),
      isActive: Boolean(product.isActive),
    };
  }

  private toTransferLog(
    row: any,
    productNameById: Record<string, string>
  ): StockTransferLog {
    const meta = this.repo.unpackTransferNotes(row.notes);
    return {
      id: row.id,
      fromWarehouseId: row.fromWarehouseId,
      fromWarehouseName: row.fromWarehouse?.name ?? "",
      toWarehouseId: row.toWarehouseId,
      toWarehouseName: row.toWarehouse?.name ?? "",
      transferDate: row.transferDate,
      notes: meta.notes,
      referenceNumber:
        meta.referenceNumber || String(row.id).slice(-8).toUpperCase(),
      status: "CONFIRMED",
      items: (row.items ?? []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: productNameById[item.productId] ?? item.productId,
        quantity: Number(item.quantity ?? 0),
      })),
      createdAt: row.createdAt,
    };
  }

  async listWarehouses(businessId: string, params: WarehouseQueryParams) {
    const rows = await this.repo.findWarehouses(businessId, params);
    return rows.map((row) => this.toWarehouseLocation(row));
  }

  async createWarehouse(businessId: string, input: CreateWarehouseInput) {
    const created = await this.repo.createWarehouse(businessId, input);
    return this.toWarehouseLocation(created);
  }

  async updateWarehouse(
    businessId: string,
    warehouseId: string,
    input: UpdateWarehouseInput
  ) {
    const existing = await this.repo.findWarehouseById(businessId, warehouseId);
    if (!existing) {
      throw new ErrorResponse("Warehouse not found for this business", 404);
    }
    const updated = await this.repo.updateWarehouse(
      businessId,
      warehouseId,
      input,
      existing.address
    );
    return this.toWarehouseLocation(updated);
  }

  async listProducts(businessId: string) {
    const [warehouses, products] = await Promise.all([
      this.repo.findWarehouses(businessId, { includeInactive: false }),
      this.repo.findProductsWithMovements(businessId),
    ]);
    const defaultWarehouseId =
      warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? null;

    return products.map((product) =>
      this.toProductStock(product, warehouses, defaultWarehouseId)
    );
  }

  async listTransfers(businessId: string, params: TransferQueryParams) {
    const [rows, products] = await Promise.all([
      this.repo.findTransfers(businessId, params),
      this.repo.findProductsWithMovements(businessId),
    ]);
    const productNameById = Object.fromEntries(
      products.map((p) => [p.id, p.name])
    );

    let logs = rows.map((row) => this.toTransferLog(row, productNameById));

    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      logs = logs.filter(
        (log) =>
          log.referenceNumber.toLowerCase().includes(q) ||
          log.fromWarehouseName.toLowerCase().includes(q) ||
          log.toWarehouseName.toLowerCase().includes(q) ||
          log.notes.toLowerCase().includes(q) ||
          log.items.some((item) => item.productName.toLowerCase().includes(q))
      );
    }

    const total = logs.length;
    const skip = (params.page - 1) * params.limit;

    return {
      items: logs.slice(skip, skip + params.limit),
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  async createTransfer(businessId: string, input: CreateStockTransferInput) {
    const [fromWarehouse, toWarehouse] = await Promise.all([
      this.repo.findWarehouseById(businessId, input.fromWarehouseId),
      this.repo.findWarehouseById(businessId, input.toWarehouseId),
    ]);

    if (!fromWarehouse || !fromWarehouse.isActive) {
      throw new ErrorResponse("Source warehouse not found or inactive", 404);
    }
    if (!toWarehouse || !toWarehouse.isActive) {
      throw new ErrorResponse(
        "Destination warehouse not found or inactive",
        404
      );
    }

    const warehouses = await this.repo.findWarehouses(businessId, {
      includeInactive: false,
    });
    const defaultWarehouseId =
      warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? null;

    const resolvedItems: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
    }> = [];

    for (const item of input.items) {
      const product = await this.repo.findProductById(
        businessId,
        item.productId
      );
      if (!product) {
        throw new ErrorResponse(
          `Product not found for this business: ${item.productId}`,
          404
        );
      }

      const available = this.computeWarehouseStock(
        product,
        input.fromWarehouseId,
        defaultWarehouseId
      );
      if (available + 0.0001 < item.quantity) {
        throw new ErrorResponse(
          `Insufficient stock for "${product.name}" at source warehouse. Available: ${available}, requested: ${item.quantity}`,
          400
        );
      }

      resolvedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitCost: Number(product.purchasePrice ?? 0),
      });
    }

    const created = await this.repo.createTransfer(
      businessId,
      input,
      resolvedItems
    );
    const productNameById = Object.fromEntries(
      resolvedItems.map((item) => {
        const match = created.items.find((i) => i.productId === item.productId);
        return [item.productId, match?.productId ?? item.productId];
      })
    );

    const products = await this.repo.findProductsWithMovements(businessId);
    for (const p of products) {
      productNameById[p.id] = p.name;
    }

    return this.toTransferLog(created, productNameById);
  }
}

export const goodsWarehouseService = new GoodsWarehouseService();
