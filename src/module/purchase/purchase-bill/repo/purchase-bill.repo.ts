import { prisma } from "../../../../db/prisma";
import {
  LedgerEntryType,
  PaymentStatus,
  PurchaseStatus,
  StockMovementType,
} from "../../../../generated/prisma/enums";
import type {
  CreatePurchaseBillInput,
  CreatePurchaseProductInput,
  PurchaseBillItemInput,
  PurchaseBillQueryParams,
  PurchaseProductQueryParams,
  UpdatePurchaseBillInput,
} from "../validators/purchase-bill.validators";

const purchaseInclude = {
  supplier: {
    select: {
      id: true,
      name: true,
      gstin: true,
      state: true,
      mobileNumber: true,
      email: true,
      address: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          sku: true,
          barcode: true,
          hsnCode: true,
          primaryUnit: true,
          gstRatePercent: true,
          purchasePrice: true,
          category: true,
          subCategory: true,
          brand: true,
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
  payments: {
    select: { id: true, amount: true },
  },
};

export class PurchaseBillRepository {
  async resolveWarehouseId(businessId: string, warehouseId?: string | null) {
    if (warehouseId && warehouseId !== "main") {
      const match = await prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId, isActive: true },
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
    });
    return anyWh?.id ?? null;
  }

  async ensureDefaultWarehouse(businessId: string, warehouseId?: string | null) {
    if (warehouseId && warehouseId !== "main") {
      const match = await prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId, isActive: true },
        select: { id: true },
      });
      if (match) return match.id;
    }

    const existing = await prisma.warehouse.findFirst({
      where: { businessId, isActive: true },
      orderBy: { isDefault: "desc" },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.warehouse.create({
      data: {
        businessId,
        name: "Main Warehouse",
        isDefault: true,
        isActive: true,
      },
    });
    return created.id;
  }

  async generatePurchaseNumber(businessId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    const fyTag = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
    const prefix = `TB/${fyTag}/`;

    const latest = await prisma.purchase.findFirst({
      where: {
        businessId,
        purchaseNumber: { startsWith: prefix },
      },
      orderBy: { createdAt: "desc" },
      select: { purchaseNumber: true },
    });

    let next = 1;
    if (latest?.purchaseNumber) {
      const parts = latest.purchaseNumber.split("/");
      const last = parseInt(parts[parts.length - 1] || "0", 10);
      if (!isNaN(last)) next = last + 1;
    } else {
      const count = await prisma.purchase.count({ where: { businessId } });
      next = count + 1;
    }

    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  async findSupplier(businessId: string, supplierId: string) {
    return prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });
  }

  async findBusiness(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        businessName: true,
        isActive: true,
        state: true,
      },
    });
  }

  async findProductsByIds(businessId: string, productIds: string[]) {
    return prisma.product.findMany({
      where: { businessId, id: { in: productIds } },
    });
  }

  async findAll(businessId: string, params: PurchaseBillQueryParams) {
    const { search, supplierId, status, fromDate, toDate, page = 1, limit = 20 } = params;
    const take = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(1, Number(page) || 1);

    const where: any = { businessId };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (fromDate || toDate) {
      where.purchaseDate = {};
      if (fromDate) where.purchaseDate.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.purchaseDate.lte = end;
      }
    }

    if (status && status !== "All") {
      const normalized = status.toUpperCase().replace(/[\s-]/g, "_");
      if (normalized === "DRAFT") {
        where.status = PurchaseStatus.DRAFT;
      } else if (normalized === "CANCELLED") {
        where.status = PurchaseStatus.CANCELLED;
      } else if (normalized === "CONFIRMED") {
        where.status = PurchaseStatus.CONFIRMED;
        where.paymentStatus = PaymentStatus.UNPAID;
      } else if (normalized === "PAID") {
        where.status = PurchaseStatus.CONFIRMED;
        where.paymentStatus = PaymentStatus.PAID;
      } else if (normalized === "PARTIALLYPAID" || normalized === "PARTIALLY_PAID") {
        where.status = PurchaseStatus.CONFIRMED;
        where.paymentStatus = PaymentStatus.PARTIALLY_PAID;
      }
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { purchaseNumber: { contains: q, mode: "insensitive" } },
        { supplierInvoiceNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const skip = (currentPage - 1) * take;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take,
        orderBy: { purchaseDate: "desc" },
        include: purchaseInclude,
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      purchases,
      total,
      page: currentPage,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async findById(businessId: string, id: string) {
    return prisma.purchase.findFirst({
      where: { id, businessId },
      include: purchaseInclude,
    });
  }

  async findByNumber(businessId: string, purchaseNumber: string, excludeId?: string) {
    return prisma.purchase.findFirst({
      where: {
        businessId,
        purchaseNumber,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(businessId: string, data: any) {
    const { items, ...header } = data;
    return prisma.purchase.create({
      data: {
        ...header,
        businessId,
        items: {
          create: items,
        },
      },
      include: purchaseInclude,
    });
  }

  async update(businessId: string, id: string, data: any) {
    const { items, ...header } = data;

    return prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id },
        data: header,
      });

      if (items) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({
          data: items.map((item: any) => ({
            ...item,
            purchaseId: id,
          })),
        });
      }

      return tx.purchase.findFirstOrThrow({
        where: { id, businessId },
        include: purchaseInclude,
      });
    });
  }

  async confirmPurchase(
    businessId: string,
    purchaseId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number; rate: number }>
  ) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({
        where: { id: purchaseId, businessId },
        include: { supplier: { select: { name: true } } },
      });

      const alreadyMoved = await tx.stockMovement.count({
        where: {
          businessId,
          referenceType: "PURCHASE",
          referenceId: purchaseId,
        },
      });

      if (alreadyMoved === 0) {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              warehouseId,
              movementType: StockMovementType.PURCHASE,
              quantity: Math.abs(item.quantity),
              unitCost: item.rate,
              referenceType: "PURCHASE",
              referenceId: purchaseId,
              movementDate: purchase.purchaseDate,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
            data: { purchasePrice: item.rate },
          });
        }
      }

      const existingLedger = await tx.ledgerEntry.findFirst({
        where: { purchaseId, businessId, entryType: LedgerEntryType.CREDIT },
      });

      if (!existingLedger) {
        await tx.ledgerEntry.create({
          data: {
            businessId,
            supplierId: purchase.supplierId,
            purchaseId,
            entryDate: purchase.purchaseDate,
            particulars: `Purchase Bill ${purchase.purchaseNumber || purchase.supplierInvoiceNumber || purchaseId} - ${purchase.supplier.name}`,
            entryType: LedgerEntryType.CREDIT,
            debitAmount: 0,
            creditAmount: purchase.totalAmount,
            runningBalance: 0,
            referenceNumber: purchase.purchaseNumber || purchase.supplierInvoiceNumber,
          },
        });
      }

      return tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatus.CONFIRMED,
          isConfirmed: true,
          warehouseId,
        },
        include: purchaseInclude,
      });
    });
  }

  async cancelPurchase(businessId: string, purchaseId: string) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({
        where: { id: purchaseId, businessId },
        include: { items: true },
      });

      const movements = await tx.stockMovement.findMany({
        where: {
          businessId,
          referenceType: "PURCHASE",
          referenceId: purchaseId,
        },
      });

      for (const movement of movements) {
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            movementType: StockMovementType.STOCK_ADJUSTMENT,
            quantity: -Number(movement.quantity),
            unitCost: movement.unitCost,
            referenceType: "PURCHASE_CANCEL",
            referenceId: purchaseId,
          },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          businessId,
          supplierId: purchase.supplierId,
          purchaseId,
          entryDate: new Date(),
          particulars: `Cancellation of Purchase Bill ${purchase.purchaseNumber || purchase.supplierInvoiceNumber || purchaseId}`,
          entryType: LedgerEntryType.DEBIT,
          debitAmount: purchase.totalAmount,
          creditAmount: 0,
          runningBalance: 0,
          referenceNumber: purchase.purchaseNumber,
        },
      });

      return tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatus.CANCELLED,
          isConfirmed: false,
        },
        include: purchaseInclude,
      });
    });
  }

  async delete(businessId: string, id: string) {
    return prisma.purchase.delete({
      where: { id },
    });
  }

  async getMetrics(businessId: string) {
    const [total, draft, confirmed, cancelled, unpaid, paid, aggregates] = await Promise.all([
      prisma.purchase.count({ where: { businessId } }),
      prisma.purchase.count({ where: { businessId, status: PurchaseStatus.DRAFT } }),
      prisma.purchase.count({ where: { businessId, status: PurchaseStatus.CONFIRMED } }),
      prisma.purchase.count({ where: { businessId, status: PurchaseStatus.CANCELLED } }),
      prisma.purchase.count({
        where: {
          businessId,
          status: PurchaseStatus.CONFIRMED,
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
        },
      }),
      prisma.purchase.count({
        where: { businessId, status: PurchaseStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID },
      }),
      prisma.purchase.aggregate({
        where: { businessId, status: { not: PurchaseStatus.CANCELLED } },
        _sum: { totalAmount: true, taxableValue: true, gstAmount: true },
      }),
    ]);

    return {
      totalBills: total,
      draftCount: draft,
      confirmedCount: confirmed,
      cancelledCount: cancelled,
      unpaidCount: unpaid,
      paidCount: paid,
      totalPayable: Number(aggregates._sum.totalAmount || 0),
      totalTaxable: Number(aggregates._sum.taxableValue || 0),
      totalGst: Number(aggregates._sum.gstAmount || 0),
    };
  }

  async findPurchaseProducts(businessId: string, params: PurchaseProductQueryParams) {
    const search = params.search || params.q;
    const { category, subCategory, barcode, page = 1, limit = 50 } = params;
    const take = Math.min(Number(limit) || 50, 100);
    const currentPage = Math.max(1, Number(page) || 1);

    const where: any = { businessId, isActive: true };

    if (category && category !== "All") {
      where.category = { equals: category.trim(), mode: "insensitive" };
    }
    if (subCategory && subCategory !== "All") {
      where.subCategory = { equals: subCategory.trim(), mode: "insensitive" };
    }
    if (barcode && barcode.trim()) {
      where.OR = [
        { barcode: { equals: barcode.trim(), mode: "insensitive" } },
        { sku: { equals: barcode.trim(), mode: "insensitive" } },
        { itemCode: { equals: barcode.trim(), mode: "insensitive" } },
      ];
    } else if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { itemCode: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { subCategory: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { hsnCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const skip = (currentPage - 1) * take;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: [{ category: "asc" }, { subCategory: "asc" }, { name: "asc" }],
        include: {
          warehouse: { select: { id: true, name: true } },
          stockMovements: { select: { quantity: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page: currentPage,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async getProductTaxonomy(businessId: string) {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { category: true, subCategory: true },
      orderBy: [{ category: "asc" }, { subCategory: "asc" }],
    });

    const map = new Map<string, Set<string>>();
    for (const p of products) {
      const cat = (p.category || "General").trim() || "General";
      if (!map.has(cat)) map.set(cat, new Set());
      if (p.subCategory && p.subCategory.trim()) {
        map.get(cat)!.add(p.subCategory.trim());
      }
    }

    return Array.from(map.entries()).map(([category, subs]) => ({
      category,
      subCategories: Array.from(subs),
    }));
  }

  async findProductById(businessId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, businessId },
      include: {
        warehouse: { select: { id: true, name: true } },
        stockMovements: { select: { quantity: true } },
      },
    });
  }

  async findProductByCodeOrBarcode(businessId: string, value: string, excludeId?: string) {
    const clean = value.trim();
    return prisma.product.findFirst({
      where: {
        businessId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { itemCode: { equals: clean, mode: "insensitive" } },
          { sku: { equals: clean, mode: "insensitive" } },
          { barcode: { equals: clean, mode: "insensitive" } },
        ],
      },
    });
  }

  async createProduct(businessId: string, data: CreatePurchaseProductInput) {
    const warehouseId = await this.resolveWarehouseId(businessId, data.warehouseId);
    return prisma.product.create({
      data: {
        businessId,
        name: data.name,
        itemCode: data.itemCode,
        sku: data.sku,
        barcode: data.barcode,
        hsnCode: data.hsnCode,
        primaryUnit: data.primaryUnit,
        secondaryUnit: data.secondaryUnit,
        gstRatePercent: data.gstRatePercent,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        mrp: data.mrp,
        wholesalePrice: data.wholesalePrice,
        minStockLevel: data.minStockLevel,
        openingStock: data.openingStock,
        hasBatchTracking: data.hasBatchTracking,
        hasSerialTracking: data.hasSerialTracking,
        hasExpiryTracking: data.hasExpiryTracking,
        warehouseId,
        rackOrBin: data.rackOrBin,
        category: data.category,
        subCategory: data.subCategory,
        brand: data.brand,
        isActive: data.isActive,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        stockMovements: { select: { quantity: true } },
      },
    });
  }
}

export const purchaseBillRepository = new PurchaseBillRepository();

export type { CreatePurchaseBillInput, PurchaseBillItemInput, UpdatePurchaseBillInput };
