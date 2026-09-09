import { ErrorResponse } from "../../../../utils/response.util";
import { PurchaseReturnStatus } from "../../../../generated/prisma/enums";
import {
  purchaseReturnRepository,
  PurchaseReturnRepository,
} from "../repo/purchase-return.repo";
import type {
  CreatePurchaseReturnInput,
  EligiblePurchaseQueryParams,
  PurchaseReturnItemInput,
  PurchaseReturnQueryParams,
  UpdatePurchaseReturnInput,
  UpdatePurchaseReturnStatusInput,
} from "../validators/purchase-return.validators";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export class PurchaseReturnService {
  private repo: PurchaseReturnRepository;

  constructor(repo: PurchaseReturnRepository = purchaseReturnRepository) {
    this.repo = repo;
  }

  private async validateBusiness(businessId: string) {
    if (!businessId?.trim()) {
      throw new ErrorResponse("Business ID is required.", 400);
    }
    const business = await this.repo.findBusiness(businessId);
    if (!business) {
      throw new ErrorResponse("Target organization/business not found.", 404);
    }
    if (!business.isActive) {
      throw new ErrorResponse("Target organization is currently inactive.", 403);
    }
    return business;
  }

  private mapUiStatus(status: PurchaseReturnStatus | string) {
    const raw = String(status || "DRAFT").toLowerCase();
    if (raw === "confirmed") return "confirmed";
    if (raw === "adjusted") return "adjusted";
    if (raw === "refunded") return "refunded";
    if (raw === "cancelled" || raw === "canceled") return "cancelled";
    return "draft";
  }

  private formatPurchaseReturn(row: any) {
    const debitNoteNumber = row.debitNote?.noteNumber || "";
    const supplier = row.purchase?.supplier;
    const items = (row.items ?? []).map((item: any) => {
      const taxable = Number(item.taxableValue ?? 0);
      const gstAmount = Number(item.gstAmount ?? 0);
      const lineTotal = Number(item.lineTotal ?? taxable + gstAmount);
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName || "",
        hsnCode: item.hsnCode || "",
        quantity: Number(item.quantity ?? 0),
        quantityReturned: Number(item.quantity ?? 0),
        unit: item.unit || "PCS",
        rate: Number(item.rate ?? 0),
        unitPrice: Number(item.rate ?? 0),
        gstRate: Number(item.gstRatePercent ?? 0),
        gstRatePercent: Number(item.gstRatePercent ?? 0),
        taxableValue: taxable,
        gstAmount,
        taxAmount: gstAmount,
        lineTotal,
        totalAmount: lineTotal,
        returnReason: item.returnReason || row.reason || "",
      };
    });

    return {
      id: row.id,
      businessId: row.businessId,
      purchaseId: row.purchaseId,
      originalPurchaseId: row.purchaseId,
      originalPurchaseBillNumber:
        row.purchase?.purchaseNumber ||
        row.purchase?.supplierInvoiceNumber ||
        "",
      purchaseNumber: row.purchase?.purchaseNumber || "",
      supplierInvoiceNumber: row.purchase?.supplierInvoiceNumber || "",
      supplierId: supplier?.id || row.purchase?.supplierId || "",
      supplierName: supplier?.name || "",
      supplierGstin: supplier?.gstin || "",
      supplier: supplier || null,
      debitNoteNumber,
      debitNoteId: row.debitNote?.id || "",
      returnDate: row.returnDate,
      reason: row.reason || "",
      returnReason: row.reason || "",
      notes: row.notes || "",
      status: this.mapUiStatus(row.status),
      documentStatus: row.status,
      taxableValue: Number(row.taxableValue ?? 0),
      subtotal: Number(row.taxableValue ?? 0),
      gstAmount: Number(row.gstAmount ?? 0),
      taxAmount: Number(row.gstAmount ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
      amountAdjusted: Number(row.amountAdjusted ?? 0),
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private computeLine(item: PurchaseReturnItemInput, purchaseItem: any) {
    const qty = Number(item.quantity || item.quantityReturned || 0);
    if (qty <= 0) {
      throw new ErrorResponse("Return quantity must be greater than zero.", 400);
    }

    const rate = Number(
      item.rate || item.unitPrice || purchaseItem?.rate || 0
    );
    const gstRate = Number(
      item.gstRatePercent ||
        item.gstRate ||
        purchaseItem?.gstRatePercent ||
        purchaseItem?.product?.gstRatePercent ||
        0
    );

    const taxableValue =
      Number(item.taxableValue) > 0
        ? Number(item.taxableValue)
        : round2(qty * rate);
    const gstAmount =
      Number(item.gstAmount || item.taxAmount) > 0
        ? Number(item.gstAmount || item.taxAmount)
        : round2(taxableValue * (gstRate / 100));
    const lineTotal =
      Number(item.lineTotal || item.totalAmount) > 0
        ? Number(item.lineTotal || item.totalAmount)
        : round2(taxableValue + gstAmount);

    return {
      productId: item.productId,
      productName:
        item.productName ||
        item.name ||
        purchaseItem?.productName ||
        purchaseItem?.product?.name ||
        null,
      hsnCode:
        item.hsnCode ||
        purchaseItem?.hsnCode ||
        purchaseItem?.product?.hsnCode ||
        null,
      unit:
        item.unit ||
        purchaseItem?.unit ||
        purchaseItem?.product?.primaryUnit ||
        "PCS",
      quantity: round3(qty),
      rate: round2(rate),
      gstRatePercent: gstRate,
      taxableValue,
      gstAmount,
      lineTotal,
      returnReason: item.returnReason || null,
    };
  }

  private async buildReturnPayload(
    businessId: string,
    input: CreatePurchaseReturnInput | UpdatePurchaseReturnInput,
    purchaseId: string,
    excludeReturnId?: string
  ) {
    const purchase = await this.repo.findConfirmedPurchase(businessId, purchaseId);
    if (!purchase) {
      throw new ErrorResponse(
        "Original purchase bill not found or is not confirmed. Only confirmed purchases can be returned.",
        404
      );
    }

    const itemsInput = input.items;
    if (!itemsInput || itemsInput.length === 0) {
      throw new ErrorResponse("Please add at least one product to return.", 400);
    }

    const returnedMap = await this.repo.getReturnedQuantitiesByPurchase(
      businessId,
      purchaseId,
      excludeReturnId
    );

    const purchaseItemMap = new Map(
      purchase.items.map((item) => [item.productId, item])
    );

    const computedItems = itemsInput.map((item) => {
      const purchaseItem = purchaseItemMap.get(item.productId);
      if (!purchaseItem) {
        throw new ErrorResponse(
          `Product ${item.productId} was not part of the original purchase bill.`,
          400
        );
      }

      const line = this.computeLine(item, purchaseItem);
      const alreadyReturned = returnedMap.get(item.productId) || 0;
      const purchasedQty = Number(purchaseItem.quantity);
      const remaining = round3(purchasedQty - alreadyReturned);

      if (line.quantity > remaining + 0.0001) {
        throw new ErrorResponse(
          `Return qty for "${line.productName || item.productId}" (${line.quantity}) exceeds remaining returnable qty (${remaining}).`,
          400
        );
      }

      return {
        ...line,
        returnReason: line.returnReason || (input as any).reason || null,
      };
    });

    const taxableValue = round2(
      computedItems.reduce((s, i) => s + i.taxableValue, 0)
    );
    const gstAmount = round2(computedItems.reduce((s, i) => s + i.gstAmount, 0));
    const totalAmount = round2(
      computedItems.reduce((s, i) => s + i.lineTotal, 0)
    );

    const reason =
      (input as any).reason ||
      (input as any).returnReason ||
      computedItems[0]?.returnReason ||
      null;

    if (!reason) {
      throw new ErrorResponse("Return reason is required.", 400);
    }

    let debitNoteNumber =
      (input as any).debitNoteNumber || (input as any).noteNumber || null;
    if (!debitNoteNumber) {
      debitNoteNumber = await this.repo.generateDebitNoteNumber(businessId);
    }

    const status = (input as any).status || PurchaseReturnStatus.DRAFT;
    const amountAdjusted = Number((input as any).amountAdjusted || 0);

    return {
      purchase,
      header: {
        purchaseId,
        returnDate: (input as any).returnDate || new Date(),
        reason,
        notes: (input as any).notes || null,
        status,
        taxableValue,
        gstAmount,
        totalAmount,
        amountAdjusted:
          status === PurchaseReturnStatus.ADJUSTED ||
          status === PurchaseReturnStatus.REFUNDED
            ? amountAdjusted > 0
              ? amountAdjusted
              : totalAmount
            : amountAdjusted,
      },
      items: computedItems,
      debitNoteNumber,
      supplierId: purchase.supplierId,
    };
  }

  async getNextDebitNoteNumber(businessId: string) {
    await this.validateBusiness(businessId);
    const debitNoteNumber = await this.repo.generateDebitNoteNumber(businessId);
    return { debitNoteNumber, noteNumber: debitNoteNumber };
  }

  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }

  async getEligiblePurchases(
    businessId: string,
    query: EligiblePurchaseQueryParams
  ) {
    await this.validateBusiness(businessId);
    const result = await this.repo.findEligiblePurchases(businessId, query);

    const purchases = result.purchases.map((purchase: any) => {
      const returnedMap = new Map<string, number>();
      for (const ret of purchase.purchaseReturns || []) {
        for (const item of ret.items || []) {
          const prev = returnedMap.get(item.productId) || 0;
          returnedMap.set(item.productId, prev + Number(item.quantity));
        }
      }

      const items = (purchase.items || []).map((item: any) => {
        const purchasedQty = Number(item.quantity);
        const alreadyReturned = returnedMap.get(item.productId) || 0;
        const remainingQty = round3(Math.max(0, purchasedQty - alreadyReturned));
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName || "",
          hsnCode: item.hsnCode || "",
          quantity: purchasedQty,
          alreadyReturned,
          remainingQty,
          unit: item.unit || "PCS",
          rate: Number(item.rate ?? 0),
          gstRate: Number(item.gstRatePercent ?? 0),
          gstRatePercent: Number(item.gstRatePercent ?? 0),
          lineTotal: Number(item.lineTotal ?? 0),
        };
      });

      return {
        id: purchase.id,
        purchaseNumber: purchase.purchaseNumber || "",
        supplierInvoiceNumber: purchase.supplierInvoiceNumber || "",
        purchaseDate: purchase.purchaseDate,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier?.name || "",
        supplierGstin: purchase.supplier?.gstin || "",
        totalAmount: Number(purchase.totalAmount ?? 0),
        items: items.filter((i: any) => i.remainingQty > 0),
        hasReturnableItems: items.some((i: any) => i.remainingQty > 0),
      };
    });

    return {
      purchases: purchases.filter((p: any) => p.hasReturnableItems),
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

  async getReturnableItems(businessId: string, purchaseId: string) {
    await this.validateBusiness(businessId);
    const purchase = await this.repo.findConfirmedPurchase(businessId, purchaseId);
    if (!purchase) {
      throw new ErrorResponse("Confirmed purchase bill not found.", 404);
    }

    const returnedMap = await this.repo.getReturnedQuantitiesByPurchase(
      businessId,
      purchaseId
    );

    const items = purchase.items.map((item) => {
      const purchasedQty = Number(item.quantity);
      const alreadyReturned = returnedMap.get(item.productId) || 0;
      const remainingQty = round3(Math.max(0, purchasedQty - alreadyReturned));
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName || item.product?.name || "",
        hsnCode: item.hsnCode || item.product?.hsnCode || "",
        quantity: purchasedQty,
        alreadyReturned,
        remainingQty,
        unit: item.unit || item.product?.primaryUnit || "PCS",
        rate: Number(item.rate ?? 0),
        gstRate: Number(item.gstRatePercent ?? item.product?.gstRatePercent ?? 0),
        gstRatePercent: Number(
          item.gstRatePercent ?? item.product?.gstRatePercent ?? 0
        ),
        lineTotal: Number(item.lineTotal ?? 0),
      };
    });

    return {
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber || "",
      supplierInvoiceNumber: purchase.supplierInvoiceNumber || "",
      purchaseDate: purchase.purchaseDate,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name || "",
      supplierGstin: purchase.supplier?.gstin || "",
      warehouseId: purchase.warehouseId || "",
      items: items.filter((i) => i.remainingQty > 0),
    };
  }

  async createPurchaseReturn(businessId: string, input: CreatePurchaseReturnInput) {
    await this.validateBusiness(businessId);

    const payload = await this.buildReturnPayload(
      businessId,
      input,
      input.purchaseId
    );

    const duplicate = await this.repo.findDebitNoteByNumber(
      businessId,
      payload.debitNoteNumber
    );
    if (duplicate) {
      throw new ErrorResponse(
        `Debit note number "${payload.debitNoteNumber}" already exists.`,
        409
      );
    }

    const created = await this.repo.create(businessId, {
      ...payload.header,
      items: payload.items,
      debitNoteNumber: payload.debitNoteNumber,
      supplierId: payload.supplierId,
    });

    if (
      payload.header.status === PurchaseReturnStatus.CONFIRMED ||
      payload.header.status === PurchaseReturnStatus.ADJUSTED ||
      payload.header.status === PurchaseReturnStatus.REFUNDED
    ) {
      const warehouseId = await this.repo.ensureDefaultWarehouse(
        businessId,
        payload.purchase.warehouseId
      );
      const confirmed = await this.repo.confirmReturn(
        businessId,
        created.id,
        warehouseId,
        payload.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.rate,
        })),
        {
          id: payload.purchase.id,
          supplierId: payload.purchase.supplierId,
          purchaseNumber: payload.purchase.purchaseNumber,
        },
        payload.header.totalAmount,
        payload.debitNoteNumber
      );

      if (
        payload.header.status === PurchaseReturnStatus.ADJUSTED ||
        payload.header.status === PurchaseReturnStatus.REFUNDED
      ) {
        const settled = await this.repo.updateStatus(
          businessId,
          confirmed.id,
          payload.header.status,
          payload.header.amountAdjusted,
          payload.header.notes
        );
        return this.formatPurchaseReturn(settled);
      }

      return this.formatPurchaseReturn(confirmed);
    }

    return this.formatPurchaseReturn(created);
  }

  async getPurchaseReturns(businessId: string, query: PurchaseReturnQueryParams) {
    await this.validateBusiness(businessId);
    const result = await this.repo.findAll(businessId, query);
    return {
      purchaseReturns: result.returns.map((r) => this.formatPurchaseReturn(r)),
      returns: result.returns.map((r) => this.formatPurchaseReturn(r)),
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

  async getPurchaseReturnById(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const row = await this.repo.findById(businessId, id);
    if (!row) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    return this.formatPurchaseReturn(row);
  }

  async updatePurchaseReturn(
    businessId: string,
    id: string,
    input: UpdatePurchaseReturnInput
  ) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    if (existing.status === PurchaseReturnStatus.CANCELLED) {
      throw new ErrorResponse("Cancelled purchase returns cannot be edited.", 400);
    }
    if (existing.status !== PurchaseReturnStatus.DRAFT) {
      throw new ErrorResponse(
        "Only draft purchase returns can be edited. Cancel and recreate if required.",
        400
      );
    }

    const mergedItems =
      input.items ||
      existing.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        name: item.productName,
        hsnCode: item.hsnCode,
        unit: item.unit || "PCS",
        quantity: Number(item.quantity),
        quantityReturned: Number(item.quantity),
        rate: Number(item.rate),
        unitPrice: Number(item.rate),
        gstRate: Number(item.gstRatePercent),
        gstRatePercent: Number(item.gstRatePercent),
        taxableValue: Number(item.taxableValue),
        gstAmount: Number(item.gstAmount),
        taxAmount: Number(item.gstAmount),
        lineTotal: Number(item.lineTotal),
        totalAmount: Number(item.lineTotal),
        returnReason: item.returnReason,
      }));

    const merged: CreatePurchaseReturnInput = {
      purchaseId: existing.purchaseId,
      debitNoteNumber:
        input.debitNoteNumber ||
        input.noteNumber ||
        existing.debitNote?.noteNumber ||
        null,
      noteNumber:
        input.noteNumber ||
        input.debitNoteNumber ||
        existing.debitNote?.noteNumber ||
        null,
      returnDate: input.returnDate || existing.returnDate,
      reason: input.reason || existing.reason || "Purchase return",
      returnReason: input.returnReason || input.reason || existing.reason,
      notes: input.notes ?? existing.notes,
      status: input.status || existing.status,
      amountAdjusted:
        input.amountAdjusted ?? Number(existing.amountAdjusted || 0),
      items: mergedItems,
    };

    const payload = await this.buildReturnPayload(
      businessId,
      merged,
      existing.purchaseId,
      id
    );

    if (
      payload.debitNoteNumber &&
      payload.debitNoteNumber !== existing.debitNote?.noteNumber
    ) {
      const duplicate = await this.repo.findDebitNoteByNumber(
        businessId,
        payload.debitNoteNumber,
        id
      );
      if (duplicate) {
        throw new ErrorResponse(
          `Debit note number "${payload.debitNoteNumber}" already exists.`,
          409
        );
      }
    }

    const updated = await this.repo.update(businessId, id, {
      ...payload.header,
      items: payload.items,
      debitNoteNumber: payload.debitNoteNumber,
    });

    if (
      payload.header.status === PurchaseReturnStatus.CONFIRMED ||
      payload.header.status === PurchaseReturnStatus.ADJUSTED ||
      payload.header.status === PurchaseReturnStatus.REFUNDED
    ) {
      const warehouseId = await this.repo.ensureDefaultWarehouse(
        businessId,
        payload.purchase.warehouseId
      );
      const confirmed = await this.repo.confirmReturn(
        businessId,
        id,
        warehouseId,
        payload.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.rate,
        })),
        {
          id: payload.purchase.id,
          supplierId: payload.purchase.supplierId,
          purchaseNumber: payload.purchase.purchaseNumber,
        },
        payload.header.totalAmount,
        payload.debitNoteNumber
      );

      if (
        payload.header.status === PurchaseReturnStatus.ADJUSTED ||
        payload.header.status === PurchaseReturnStatus.REFUNDED
      ) {
        const settled = await this.repo.updateStatus(
          businessId,
          confirmed.id,
          payload.header.status,
          payload.header.amountAdjusted,
          payload.header.notes
        );
        return this.formatPurchaseReturn(settled);
      }

      return this.formatPurchaseReturn(confirmed);
    }

    return this.formatPurchaseReturn(updated);
  }

  async confirmPurchaseReturn(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    if (existing.status === PurchaseReturnStatus.CANCELLED) {
      throw new ErrorResponse("Cancelled purchase returns cannot be confirmed.", 400);
    }
    if (existing.status !== PurchaseReturnStatus.DRAFT) {
      return this.formatPurchaseReturn(existing);
    }

    const warehouseId = await this.repo.ensureDefaultWarehouse(
      businessId,
      existing.purchase?.warehouseId
    );

    const confirmed = await this.repo.confirmReturn(
      businessId,
      id,
      warehouseId,
      existing.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
      {
        id: existing.purchaseId,
        supplierId: existing.purchase?.supplierId || "",
        purchaseNumber: existing.purchase?.purchaseNumber || null,
      },
      Number(existing.totalAmount),
      existing.debitNote?.noteNumber || null
    );

    return this.formatPurchaseReturn(confirmed);
  }

  async updateStatus(
    businessId: string,
    id: string,
    input: UpdatePurchaseReturnStatusInput
  ) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    if (existing.status === PurchaseReturnStatus.CANCELLED) {
      throw new ErrorResponse("Cancelled purchase returns cannot change status.", 400);
    }

    const nextStatus = input.status;

    if (nextStatus === PurchaseReturnStatus.CANCELLED) {
      return this.cancelPurchaseReturn(businessId, id);
    }

    if (
      existing.status === PurchaseReturnStatus.DRAFT &&
      (nextStatus === PurchaseReturnStatus.CONFIRMED ||
        nextStatus === PurchaseReturnStatus.ADJUSTED ||
        nextStatus === PurchaseReturnStatus.REFUNDED)
    ) {
      await this.confirmPurchaseReturn(businessId, id);
    }

    const amountAdjusted =
      nextStatus === PurchaseReturnStatus.ADJUSTED ||
      nextStatus === PurchaseReturnStatus.REFUNDED
        ? Number(input.amountAdjusted || existing.totalAmount)
        : Number(input.amountAdjusted ?? existing.amountAdjusted ?? 0);

    const updated = await this.repo.updateStatus(
      businessId,
      id,
      nextStatus,
      amountAdjusted,
      input.notes
    );
    return this.formatPurchaseReturn(updated);
  }

  async cancelPurchaseReturn(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    if (existing.status === PurchaseReturnStatus.CANCELLED) {
      throw new ErrorResponse("Purchase return is already cancelled.", 400);
    }

    const reverseStock = existing.status !== PurchaseReturnStatus.DRAFT;
    const cancelled = await this.repo.cancelReturn(businessId, id, reverseStock);
    return this.formatPurchaseReturn(cancelled);
  }

  async deletePurchaseReturn(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase return not found.", 404);
    }
    if (existing.status !== PurchaseReturnStatus.DRAFT) {
      throw new ErrorResponse(
        "Only draft purchase returns can be deleted. Cancel confirmed returns instead.",
        400
      );
    }
    await this.repo.delete(businessId, id);
    return { message: "Purchase return deleted successfully." };
  }
}

export const purchaseReturnService = new PurchaseReturnService();
