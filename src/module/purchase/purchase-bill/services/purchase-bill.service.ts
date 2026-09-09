import { ErrorResponse } from "../../../../utils/response.util";
import { PaymentMode, PurchaseStatus } from "../../../../generated/prisma/enums";
import { purchaseBillRepository, PurchaseBillRepository } from "../repo/purchase-bill.repo";
import type {
  CreatePurchaseBillInput,
  CreatePurchaseProductInput,
  PurchaseBillItemInput,
  PurchaseBillQueryParams,
  PurchaseProductQueryParams,
  UpdatePurchaseBillInput,
} from "../validators/purchase-bill.validators";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export class PurchaseBillService {
  private repo: PurchaseBillRepository;

  constructor(repo: PurchaseBillRepository = purchaseBillRepository) {
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

  private formatProduct(product: any) {
    const netMovements = (product.stockMovements ?? []).reduce(
      (acc: number, m: any) => acc + Number(m.quantity ?? 0),
      0
    );
    const opening = Number(product.openingStock ?? 0);
    const currentStock = opening + netMovements;
    const gstRate = Number(product.gstRatePercent ?? 0);
    const purchasePrice = Number(product.purchasePrice ?? 0);

    return {
      id: product.id,
      businessId: product.businessId,
      name: product.name,
      productName: product.name,
      code: product.itemCode ?? "",
      itemCode: product.itemCode ?? "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      hsnCode: product.hsnCode ?? "",
      primaryUnit: product.primaryUnit ?? "PCS",
      secondaryUnit: product.secondaryUnit ?? "",
      unit: product.primaryUnit ?? "PCS",
      gstRate,
      gstRatePercent: gstRate,
      purchasePrice,
      rate: purchasePrice,
      sellingPrice: Number(product.sellingPrice ?? 0),
      mrp: Number(product.mrp ?? 0),
      wholesalePrice: Number(product.wholesalePrice ?? 0),
      minStockLevel: Number(product.minStockLevel ?? 0),
      openingStock: opening,
      currentStock,
      category: product.category ?? "General",
      subCategory: product.subCategory ?? "",
      brand: product.brand ?? "",
      warehouseId: product.warehouseId ?? product.warehouse?.id ?? "",
      warehouseName: product.warehouse?.name ?? "",
      rackOrBin: product.rackOrBin ?? "",
      hasBatchTracking: Boolean(product.hasBatchTracking),
      hasSerialTracking: Boolean(product.hasSerialTracking),
      hasExpiryTracking: Boolean(product.hasExpiryTracking),
      isActive: Boolean(product.isActive),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private mapUiStatus(purchase: any) {
    if (purchase.status === PurchaseStatus.CANCELLED) return "cancelled";
    if (purchase.status === PurchaseStatus.DRAFT) return "draft";
    if (purchase.paymentStatus === "PAID") return "paid";
    if (purchase.paymentStatus === "PARTIALLY_PAID") return "partiallyPaid";
    return "confirmed";
  }

  private formatPurchase(purchase: any) {
    const paidAmount = (purchase.payments ?? []).reduce(
      (sum: number, p: any) => sum + Number(p.amount ?? 0),
      0
    );
    const grandTotal = Number(purchase.totalAmount ?? 0);
    const balanceAmount = Math.max(0, round2(grandTotal - paidAmount));

    const items = (purchase.items ?? []).map((item: any) => {
      const cgst = Number(item.cgstAmount ?? 0);
      const sgst = Number(item.sgstAmount ?? 0);
      const igst = Number(item.igstAmount ?? 0);
      const cess = Number(item.cessAmount ?? 0);
      const taxable = Number(item.taxableValue ?? 0);
      return {
        id: item.id,
        productId: item.productId,
        name: item.productName || item.product?.name || "",
        productName: item.productName || item.product?.name || "",
        category: item.category || item.product?.category || "",
        subCategory: item.subCategory || item.product?.subCategory || "",
        hsnCode: item.hsnCode || item.product?.hsnCode || "",
        quantity: Number(item.quantity ?? 0),
        unit: item.unit || item.product?.primaryUnit || "PCS",
        rate: Number(item.rate ?? 0),
        discountPercent: Number(item.discountPercent ?? 0),
        discountPercentage: Number(item.discountPercent ?? 0),
        discountAmount: Number(item.discountAmount ?? 0),
        taxableValue: taxable,
        gstRate: Number(item.gstRatePercent ?? 0),
        gstRatePercent: Number(item.gstRatePercent ?? 0),
        cgst,
        sgst,
        igst,
        cess,
        gstAmount: Number(item.gstAmount ?? cgst + sgst + igst + cess),
        lineTotal: Number(item.lineTotal ?? taxable + cgst + sgst + igst + cess),
        product: item.product ? this.formatProduct({ ...item.product, stockMovements: [] }) : null,
      };
    });

    return {
      id: purchase.id,
      businessId: purchase.businessId,
      purchaseNumber: purchase.purchaseNumber || "",
      supplierInvoiceNumber: purchase.supplierInvoiceNumber || "",
      purchaseDate: purchase.purchaseDate,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name || "",
      supplier: purchase.supplier || null,
      items,
      taxableAmount: Number(purchase.taxableValue ?? 0),
      taxableValue: Number(purchase.taxableValue ?? 0),
      cgst: Number(purchase.cgstAmount ?? 0),
      sgst: Number(purchase.sgstAmount ?? 0),
      igst: Number(purchase.igstAmount ?? 0),
      cess: Number(purchase.cessAmount ?? 0),
      gstAmount: Number(purchase.gstAmount ?? 0),
      freight: Number(purchase.freight ?? 0),
      freightCharges: Number(purchase.freight ?? 0),
      otherCharges: Number(purchase.otherCharges ?? 0),
      roundOff: Number(purchase.roundOff ?? 0),
      grandTotal,
      totalAmount: grandTotal,
      paidAmount: round2(paidAmount),
      balanceAmount,
      paymentMode: purchase.paymentMode || PaymentMode.BANK,
      paymentStatus: purchase.paymentStatus,
      status: this.mapUiStatus(purchase),
      documentStatus: purchase.status,
      isConfirmed: Boolean(purchase.isConfirmed),
      warehouseId: purchase.warehouseId || "",
      notes: purchase.notes || "",
      originalPurchaseId: purchase.originalPurchaseId || "",
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }

  private computeLine(item: PurchaseBillItemInput, product: any, isInterState: boolean) {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate ?? product.purchasePrice ?? 0);
    const discountPercent = Number(
      item.discountPercent || item.discountPercentage || 0
    );
    const gross = qty * rate;
    const discountAmount =
      Number(item.discountAmount) > 0
        ? Number(item.discountAmount)
        : round2(gross * (discountPercent / 100));
    const taxableValue =
      Number(item.taxableValue) > 0
        ? Number(item.taxableValue)
        : round2(Math.max(0, gross - discountAmount));
    const gstRate = Number(
      item.gstRatePercent || item.gstRate || product.gstRatePercent || 0
    );

    let cgst = Number(item.cgstAmount || item.cgst || 0);
    let sgst = Number(item.sgstAmount || item.sgst || 0);
    let igst = Number(item.igstAmount || item.igst || 0);
    const cess = Number(item.cessAmount || item.cess || 0);

    if (cgst + sgst + igst === 0 && gstRate > 0) {
      const tax = round2(taxableValue * (gstRate / 100));
      if (isInterState) {
        igst = tax;
        cgst = 0;
        sgst = 0;
      } else {
        cgst = round2(tax / 2);
        sgst = round2(tax - cgst);
        igst = 0;
      }
    }

    const gstAmount = round2(cgst + sgst + igst + cess);
    const lineTotal =
      Number(item.lineTotal) > 0
        ? Number(item.lineTotal)
        : round2(taxableValue + gstAmount);

    return {
      productId: item.productId,
      productName: item.productName || item.name || product.name,
      category: item.category || product.category || "General",
      subCategory: item.subCategory || product.subCategory || null,
      hsnCode: item.hsnCode || product.hsnCode || null,
      quantity: round3(qty),
      unit: item.unit || product.primaryUnit || "PCS",
      rate: round2(rate),
      discountPercent,
      discountAmount,
      taxableValue,
      gstRatePercent: gstRate,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      cessAmount: cess,
      gstAmount,
      lineTotal,
    };
  }

  private async buildPurchasePayload(
    businessId: string,
    input: CreatePurchaseBillInput | UpdatePurchaseBillInput,
    existingNumber?: string | null
  ) {
    const supplierId = input.supplierId;
    if (!supplierId) {
      throw new ErrorResponse("Supplier is required", 400);
    }

    const [business, supplier] = await Promise.all([
      this.validateBusiness(businessId),
      this.repo.findSupplier(businessId, supplierId),
    ]);

    if (!supplier) {
      throw new ErrorResponse("Supplier not found in this organization.", 404);
    }
    if (!supplier.isActive) {
      throw new ErrorResponse("Selected supplier is inactive.", 400);
    }

    const itemsInput = input.items;
    if (!itemsInput || itemsInput.length === 0) {
      throw new ErrorResponse("Please add at least one product item.", 400);
    }

    const productIds = [...new Set(itemsInput.map((i) => i.productId))];
    const products = await this.repo.findProductsByIds(businessId, productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of itemsInput) {
      if (!productMap.has(item.productId)) {
        throw new ErrorResponse(
          `Product ${item.productId} was not found in this organization.`,
          404
        );
      }
    }

    const isInterState = Boolean(
      business.state &&
        supplier.state &&
        business.state.trim().toLowerCase() !== supplier.state.trim().toLowerCase()
    );

    const items = itemsInput.map((item) =>
      this.computeLine(item, productMap.get(item.productId), isInterState)
    );

    const taxableValue = round2(items.reduce((s, i) => s + i.taxableValue, 0));
    const cgstAmount = round2(items.reduce((s, i) => s + i.cgstAmount, 0));
    const sgstAmount = round2(items.reduce((s, i) => s + i.sgstAmount, 0));
    const igstAmount = round2(items.reduce((s, i) => s + i.igstAmount, 0));
    const cessAmount = round2(items.reduce((s, i) => s + i.cessAmount, 0));
    const gstAmount = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
    const freight = Number((input as any).freightCharges || (input as any).freight || 0);
    const otherCharges = Number(input.otherCharges || 0);
    const grossGrand = taxableValue + gstAmount + freight + otherCharges;
    const roundedGrand = Math.round(grossGrand);
    const roundOff = round2(roundedGrand - grossGrand);

    let purchaseNumber = input.purchaseNumber || existingNumber || null;
    if (!purchaseNumber) {
      purchaseNumber = await this.repo.generatePurchaseNumber(businessId);
    }

    const status = input.status || PurchaseStatus.DRAFT;

    return {
      header: {
        supplierId,
        purchaseNumber,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        purchaseDate: input.purchaseDate || new Date(),
        taxableValue,
        cgstAmount,
        sgstAmount,
        igstAmount,
        cessAmount,
        gstAmount,
        freight,
        otherCharges,
        roundOff,
        totalAmount: roundedGrand,
        paymentMode: input.paymentMode || PaymentMode.BANK,
        paymentStatus: "UNPAID" as const,
        status,
        isConfirmed: status === PurchaseStatus.CONFIRMED,
        warehouseId: input.warehouseId || null,
        notes: input.notes || null,
        originalPurchaseId: input.originalPurchaseId || null,
      },
      items,
    };
  }

  async getNextNumber(businessId: string) {
    await this.validateBusiness(businessId);
    const purchaseNumber = await this.repo.generatePurchaseNumber(businessId);
    return { purchaseNumber };
  }

  async createPurchaseBill(businessId: string, input: CreatePurchaseBillInput) {
    await this.validateBusiness(businessId);

    if (input.purchaseNumber) {
      const duplicate = await this.repo.findByNumber(businessId, input.purchaseNumber);
      if (duplicate) {
        throw new ErrorResponse(
          `Purchase reference "${input.purchaseNumber}" already exists.`,
          409
        );
      }
    }

    const payload = await this.buildPurchasePayload(businessId, input);
    const created = await this.repo.create(businessId, {
      ...payload.header,
      items: payload.items,
    });

    if (payload.header.status === PurchaseStatus.CONFIRMED) {
      const warehouseId = await this.repo.ensureDefaultWarehouse(
        businessId,
        input.warehouseId
      );
      const confirmed = await this.repo.confirmPurchase(
        businessId,
        created.id,
        warehouseId,
        payload.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.rate,
        }))
      );
      return this.formatPurchase(confirmed);
    }

    return this.formatPurchase(created);
  }

  async getPurchaseBills(businessId: string, query: PurchaseBillQueryParams) {
    await this.validateBusiness(businessId);
    const result = await this.repo.findAll(businessId, query);
    return {
      purchases: result.purchases.map((p) => this.formatPurchase(p)),
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

  async getPurchaseBillById(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const purchase = await this.repo.findById(businessId, id);
    if (!purchase) {
      throw new ErrorResponse("Purchase bill not found.", 404);
    }
    return this.formatPurchase(purchase);
  }

  async updatePurchaseBill(
    businessId: string,
    id: string,
    input: UpdatePurchaseBillInput
  ) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase bill not found.", 404);
    }
    if (existing.status === PurchaseStatus.CANCELLED) {
      throw new ErrorResponse("Cancelled purchase bills cannot be edited.", 400);
    }
    if (existing.isConfirmed) {
      throw new ErrorResponse(
        "Confirmed purchase bills cannot be edited. Cancel and recreate if required.",
        400
      );
    }

    if (input.purchaseNumber && input.purchaseNumber !== existing.purchaseNumber) {
      const duplicate = await this.repo.findByNumber(
        businessId,
        input.purchaseNumber,
        id
      );
      if (duplicate) {
        throw new ErrorResponse(
          `Purchase reference "${input.purchaseNumber}" already exists.`,
          409
        );
      }
    }

    const merged: CreatePurchaseBillInput = {
      supplierId: input.supplierId || existing.supplierId,
      purchaseNumber: input.purchaseNumber ?? existing.purchaseNumber,
      supplierInvoiceNumber:
        input.supplierInvoiceNumber || existing.supplierInvoiceNumber || "N/A",
      purchaseDate: input.purchaseDate || existing.purchaseDate,
      warehouseId: input.warehouseId ?? existing.warehouseId,
      freight: input.freight ?? Number(existing.freight),
      freightCharges: input.freightCharges ?? Number(existing.freight),
      otherCharges: input.otherCharges ?? Number(existing.otherCharges),
      notes: input.notes ?? existing.notes,
      paymentMode: input.paymentMode || existing.paymentMode || PaymentMode.BANK,
      status: input.status || existing.status,
      originalPurchaseId: input.originalPurchaseId ?? existing.originalPurchaseId,
      items:
        input.items ||
        existing.items.map((item) => ({
          productId: item.productId,
          name: item.productName,
          productName: item.productName,
          category: item.category,
          subCategory: item.subCategory,
          hsnCode: item.hsnCode,
          quantity: Number(item.quantity),
          unit: item.unit || "PCS",
          rate: Number(item.rate),
          discountPercent: Number(item.discountPercent),
          discountPercentage: Number(item.discountPercent),
          discountAmount: Number(item.discountAmount),
          taxableValue: Number(item.taxableValue),
          gstRate: Number(item.gstRatePercent),
          gstRatePercent: Number(item.gstRatePercent),
          cgst: Number(item.cgstAmount),
          sgst: Number(item.sgstAmount),
          igst: Number(item.igstAmount),
          cess: Number(item.cessAmount),
          cgstAmount: Number(item.cgstAmount),
          sgstAmount: Number(item.sgstAmount),
          igstAmount: Number(item.igstAmount),
          cessAmount: Number(item.cessAmount),
          lineTotal: Number(item.lineTotal),
        })),
    };

    const payload = await this.buildPurchasePayload(
      businessId,
      merged,
      existing.purchaseNumber
    );

    const updated = await this.repo.update(businessId, id, {
      ...payload.header,
      items: payload.items,
    });

    if (payload.header.status === PurchaseStatus.CONFIRMED) {
      const warehouseId = await this.repo.ensureDefaultWarehouse(
        businessId,
        input.warehouseId || existing.warehouseId
      );
      const confirmed = await this.repo.confirmPurchase(
        businessId,
        id,
        warehouseId,
        payload.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          rate: i.rate,
        }))
      );
      return this.formatPurchase(confirmed);
    }

    return this.formatPurchase(updated);
  }

  async confirmPurchaseBill(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase bill not found.", 404);
    }
    if (existing.status === PurchaseStatus.CANCELLED) {
      throw new ErrorResponse("Cancelled purchase bills cannot be confirmed.", 400);
    }
    if (existing.isConfirmed) {
      return this.formatPurchase(existing);
    }

    const warehouseId = await this.repo.ensureDefaultWarehouse(
      businessId,
      existing.warehouseId
    );

    const confirmed = await this.repo.confirmPurchase(
      businessId,
      id,
      warehouseId,
      existing.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      }))
    );
    return this.formatPurchase(confirmed);
  }

  async cancelPurchaseBill(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase bill not found.", 404);
    }
    if (existing.status === PurchaseStatus.CANCELLED) {
      throw new ErrorResponse("Purchase bill is already cancelled.", 400);
    }
    if (existing.paymentStatus === "PAID" || existing.paymentStatus === "PARTIALLY_PAID") {
      throw new ErrorResponse(
        "Purchase bills with recorded payments cannot be cancelled.",
        400
      );
    }

    const cancelled = await this.repo.cancelPurchase(businessId, id);
    return this.formatPurchase(cancelled);
  }

  async deletePurchaseBill(businessId: string, id: string) {
    await this.validateBusiness(businessId);
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse("Purchase bill not found.", 404);
    }
    if (existing.isConfirmed || existing.status !== PurchaseStatus.DRAFT) {
      throw new ErrorResponse(
        "Only draft purchase bills can be deleted. Cancel confirmed bills instead.",
        400
      );
    }
    await this.repo.delete(businessId, id);
    return { message: "Purchase bill deleted successfully." };
  }

  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }

  async getProducts(businessId: string, query: PurchaseProductQueryParams) {
    await this.validateBusiness(businessId);
    const result = await this.repo.findPurchaseProducts(businessId, query);
    const products = result.products.map((p) => this.formatProduct(p));

    const groupedMap = new Map<string, any>();
    for (const product of products) {
      const key = product.category || "General";
      if (!groupedMap.has(key)) {
        groupedMap.set(key, { category: key, subCategories: new Map<string, any[]>() });
      }
      const group = groupedMap.get(key);
      const subKey = product.subCategory || "Uncategorized";
      if (!group.subCategories.has(subKey)) {
        group.subCategories.set(subKey, []);
      }
      group.subCategories.get(subKey).push(product);
    }

    const grouped = Array.from(groupedMap.values()).map((g: any) => ({
      category: g.category,
      subCategories: Array.from(g.subCategories.entries() as Iterable<[string, any[]]>).map(
        ([name, items]) => ({
          subCategory: name,
          products: items,
        })
      ),
    }));

    return {
      products,
      grouped,
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

  async getProductCategories(businessId: string) {
    await this.validateBusiness(businessId);
    const categories = await this.repo.getProductTaxonomy(businessId);
    return { categories };
  }

  async createProduct(businessId: string, input: CreatePurchaseProductInput) {
    await this.validateBusiness(businessId);

    let itemCode = input.itemCode;
    if (!itemCode) {
      itemCode = `PRD-${Date.now().toString().slice(-6)}`;
    }

    const existingCode = await this.repo.findProductByCodeOrBarcode(businessId, itemCode);
    if (existingCode) {
      throw new ErrorResponse(
        `A product with code/SKU/barcode "${itemCode}" already exists (${existingCode.name}).`,
        409
      );
    }

    if (input.barcode) {
      const existingBarcode = await this.repo.findProductByCodeOrBarcode(
        businessId,
        input.barcode
      );
      if (existingBarcode) {
        throw new ErrorResponse(
          `A product with barcode "${input.barcode}" already exists (${existingBarcode.name}).`,
          409
        );
      }
    }

    const product = await this.repo.createProduct(businessId, { ...input, itemCode });
    return this.formatProduct(product);
  }
}

export const purchaseBillService = new PurchaseBillService();
