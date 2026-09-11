import { ErrorResponse } from "../../../../utils/response.util";
import {
  stockValuationRepository,
  StockValuationRepository,
} from "../repo/stock-valuation.repo";
import type {
  StockLedgerEntry,
  StockValuationItem,
  StockValuationSummary,
} from "../types/stock-valuation.types";
import type {
  StockAdjustmentInput,
  StockMovementQueryParams,
  StockValuationQueryParams,
} from "../validators/stock-valuation.validators";

export class StockValuationService {
  private repo: StockValuationRepository;

  constructor(repo: StockValuationRepository = stockValuationRepository) {
    this.repo = repo;
  }

  private computeCurrentStock(
    openingStock: number,
    movements: Array<{ quantity: unknown }>
  ): number {
    const net = movements.reduce((acc, m) => acc + Number(m.quantity ?? 0), 0);
    return Math.max(0, Number(openingStock ?? 0) + net);
  }

  private toValuationItem(product: any): StockValuationItem {
    const purchasePrice = Number(product.purchasePrice ?? 0);
    const openingStock = Number(product.openingStock ?? 0);
    const currentStock = this.computeCurrentStock(
      openingStock,
      product.stockMovements ?? []
    );
    const minStockLevel = Number(product.minStockLevel ?? 0);

    return {
      productId: product.id,
      name: product.name,
      itemCode: product.itemCode ?? "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      primaryUnit: product.primaryUnit ?? "PCS",
      category: product.category ?? "General",
      warehouseId: product.warehouseId ?? product.warehouse?.id ?? null,
      warehouseName: product.warehouse?.name ?? null,
      purchasePrice,
      sellingPrice: Number(product.sellingPrice ?? 0),
      openingStock,
      currentStock: Number(currentStock.toFixed(3)),
      minStockLevel,
      stockValue: Number((currentStock * purchasePrice).toFixed(2)),
      isLowStock: minStockLevel > 0 && currentStock <= minStockLevel,
      isActive: Boolean(product.isActive),
    };
  }

  private buildReferenceNumber(movement: any): string {
    if (movement.referenceType && movement.referenceId) {
      return `${movement.referenceType}-${String(movement.referenceId).slice(-8).toUpperCase()}`;
    }
    if (movement.referenceId) return String(movement.referenceId);
    if (movement.referenceType) return String(movement.referenceType);
    return String(movement.id).slice(-8).toUpperCase();
  }

  private toLedgerEntry(movement: any): StockLedgerEntry {
    const quantity = Number(movement.quantity ?? 0);
    const unitCost =
      movement.unitCost !== null && movement.unitCost !== undefined
        ? Number(movement.unitCost)
        : null;

    return {
      id: movement.id,
      productId: movement.productId,
      productName: movement.product?.name ?? "Unknown Product",
      itemCode: movement.product?.itemCode ?? "",
      warehouseId: movement.warehouseId,
      warehouseName: movement.warehouse?.name ?? "",
      movementType: movement.movementType,
      quantity: Number(quantity.toFixed(3)),
      unitCost,
      stockValueImpact:
        unitCost !== null ? Number((quantity * unitCost).toFixed(2)) : 0,
      batchNumber: movement.batchNumber ?? null,
      serialNumber: movement.serialNumber ?? null,
      referenceType: movement.referenceType ?? null,
      referenceId: movement.referenceId ?? null,
      referenceNumber: this.buildReferenceNumber(movement),
      movementDate: movement.movementDate,
      createdAt: movement.createdAt,
    };
  }

  private applyItemFilters(
    items: StockValuationItem[],
    params: StockValuationQueryParams
  ): StockValuationItem[] {
    let filtered = [...items];

    if (params.lowStockOnly) {
      filtered = filtered.filter((i) => i.isLowStock);
    }

    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.itemCode.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.barcode.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    const sortKeyMap: Record<string, keyof StockValuationItem> = {
      name: "name",
      currentStock: "currentStock",
      purchasePrice: "purchasePrice",
      stockValue: "stockValue",
      minStockLevel: "minStockLevel",
      itemCode: "itemCode",
    };
    const sortKey = sortKeyMap[params.sortBy] ?? "name";

    filtered.sort((a, b) => {
      const vA = a[sortKey];
      const vB = b[sortKey];
      if (typeof vA === "string" && typeof vB === "string") {
        return params.sortOrder === "asc"
          ? vA.localeCompare(vB)
          : vB.localeCompare(vA);
      }
      const nA = Number(vA ?? 0);
      const nB = Number(vB ?? 0);
      return params.sortOrder === "asc" ? nA - nB : nB - nA;
    });

    return filtered;
  }

  async getSummary(
    businessId: string,
    warehouseId?: string
  ): Promise<StockValuationSummary> {
    const products = await this.repo.findProductsForValuation(
      businessId,
      warehouseId
    );
    const items = products.map((p) => this.toValuationItem(p));
    const totalStockValuation = items.reduce((s, i) => s + i.stockValue, 0);
    const totalUnits = items.reduce((s, i) => s + i.currentStock, 0);

    return {
      totalStockValuation: Number(totalStockValuation.toFixed(2)),
      totalUnits: Number(totalUnits.toFixed(3)),
      uniqueProductCount: items.length,
      inStockCount: items.filter((i) => i.currentStock > 0).length,
      lowStockCount: items.filter((i) => i.isLowStock).length,
      zeroStockCount: items.filter((i) => i.currentStock <= 0).length,
      valuationMethod: "PURCHASE_PRICE",
    };
  }

  async getValuationItems(
    businessId: string,
    params: StockValuationQueryParams
  ) {
    const products = await this.repo.findProductsForValuation(
      businessId,
      params.warehouseId
    );
    const items = this.applyItemFilters(
      products.map((p) => this.toValuationItem(p)),
      params
    );

    const total = items.length;
    const skip = (params.page - 1) * params.limit;
    const pageItems = items.slice(skip, skip + params.limit);
    const pageStockValue = pageItems.reduce((s, i) => s + i.stockValue, 0);

    return {
      items: pageItems,
      pageStockValue: Number(pageStockValue.toFixed(2)),
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  async getStockMovements(
    businessId: string,
    params: StockMovementQueryParams
  ) {
    const movements = await this.repo.findStockMovements(businessId, params);
    const entries = movements.map((m) => this.toLedgerEntry(m));
    const total = entries.length;
    const skip = (params.page - 1) * params.limit;

    return {
      items: entries.slice(skip, skip + params.limit),
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  async createAdjustment(businessId: string, input: StockAdjustmentInput) {
    const product = await this.repo.findProductById(businessId, input.productId);
    if (!product) {
      throw new ErrorResponse("Product not found for this business", 404);
    }

    const warehouseId = await this.repo.resolveWarehouseId(
      businessId,
      input.warehouseId || product.warehouseId
    );
    if (!warehouseId) {
      throw new ErrorResponse(
        "No active warehouse found. Please create a warehouse before adjusting stock.",
        400
      );
    }

    const products = await this.repo.findProductsForValuation(businessId);
    const target = products.find((p) => p.id === input.productId);
    const currentStock = target
      ? this.computeCurrentStock(
          Number(product.openingStock ?? 0),
          target.stockMovements ?? []
        )
      : Math.max(0, Number(product.quantity ?? product.openingStock ?? 0));

    if (input.quantity < 0 && currentStock + input.quantity < -0.0001) {
      throw new ErrorResponse(
        `Insufficient stock for "${product.name}". Available: ${currentStock}, requested reduction: ${Math.abs(input.quantity)}`,
        400
      );
    }

    const movement = await this.repo.createStockAdjustment(
      businessId,
      warehouseId,
      {
        ...input,
        unitCost:
          input.unitCost !== undefined
            ? input.unitCost
            : Number(product.purchasePrice ?? 0),
      }
    );

    return this.toLedgerEntry(movement);
  }
}

export const stockValuationService = new StockValuationService();

