import { prisma } from "../../../../db/prisma";
import {
  LedgerEntryType,
  PurchaseReturnStatus,
  PurchaseStatus,
  StockMovementType,
} from "../../../../generated/prisma/enums";
import type {
  EligiblePurchaseQueryParams,
  PurchaseReturnQueryParams,
} from "../validators/purchase-return.validators";

const purchaseReturnInclude = {
  purchase: {
    select: {
      id: true,
      purchaseNumber: true,
      supplierInvoiceNumber: true,
      purchaseDate: true,
      warehouseId: true,
      supplierId: true,
      status: true,
      isConfirmed: true,
      totalAmount: true,
      supplier: {
        select: {
          id: true,
          name: true,
          gstin: true,
          state: true,
          mobileNumber: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          hsnCode: true,
          quantity: true,
          unit: true,
          rate: true,
          gstRatePercent: true,
          taxableValue: true,
          gstAmount: true,
          lineTotal: true,
        },
      },
    },
  },
  items: {
    orderBy: { id: "asc" as const },
  },
  debitNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      amount: true,
      reason: true,
      supplierId: true,
    },
  },
};

export class PurchaseReturnRepository {
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

  async generateDebitNoteNumber(businessId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fyStart = month >= 4 ? year : year - 1;
    const fyTag = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
    const prefix = `DN/${fyTag}/`;

    const latest = await prisma.debitNote.findFirst({
      where: {
        businessId,
        noteNumber: { startsWith: prefix },
      },
      orderBy: { createdAt: "desc" },
      select: { noteNumber: true },
    });

    let next = 1;
    if (latest?.noteNumber) {
      const parts = latest.noteNumber.split("/");
      const last = parseInt(parts[parts.length - 1] || "0", 10);
      if (!isNaN(last)) next = last + 1;
    } else {
      const count = await prisma.debitNote.count({ where: { businessId } });
      next = count + 1;
    }

    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  async findDebitNoteByNumber(
    businessId: string,
    noteNumber: string,
    excludePurchaseReturnId?: string
  ) {
    return prisma.debitNote.findFirst({
      where: {
        businessId,
        noteNumber,
        ...(excludePurchaseReturnId
          ? { purchaseReturnId: { not: excludePurchaseReturnId } }
          : {}),
      },
    });
  }

  async findConfirmedPurchase(businessId: string, purchaseId: string) {
    return prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId,
        status: PurchaseStatus.CONFIRMED,
        isConfirmed: true,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            gstin: true,
            state: true,
            isActive: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                hsnCode: true,
                primaryUnit: true,
                gstRatePercent: true,
              },
            },
          },
        },
      },
    });
  }

  async findEligiblePurchases(businessId: string, params: EligiblePurchaseQueryParams) {
    const search = params.search || params.q;
    const take = Math.min(Number(params.limit) || 20, 100);
    const currentPage = Math.max(1, Number(params.page) || 1);
    const skip = (currentPage - 1) * take;

    const where: any = {
      businessId,
      status: PurchaseStatus.CONFIRMED,
      isConfirmed: true,
    };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { purchaseNumber: { contains: q, mode: "insensitive" } },
        { supplierInvoiceNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take,
        orderBy: { purchaseDate: "desc" },
        include: {
          supplier: {
            select: { id: true, name: true, gstin: true },
          },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              hsnCode: true,
              quantity: true,
              unit: true,
              rate: true,
              gstRatePercent: true,
              lineTotal: true,
            },
          },
          purchaseReturns: {
            where: { status: { not: PurchaseReturnStatus.CANCELLED } },
            include: {
              items: {
                select: { productId: true, quantity: true },
              },
            },
          },
        },
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

  async getReturnedQuantitiesByPurchase(
    businessId: string,
    purchaseId: string,
    excludeReturnId?: string
  ) {
    const returns = await prisma.purchaseReturn.findMany({
      where: {
        businessId,
        purchaseId,
        status: { not: PurchaseReturnStatus.CANCELLED },
        ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
      },
      include: {
        items: { select: { productId: true, quantity: true } },
      },
    });

    const map = new Map<string, number>();
    for (const ret of returns) {
      for (const item of ret.items) {
        const prev = map.get(item.productId) || 0;
        map.set(item.productId, prev + Number(item.quantity));
      }
    }
    return map;
  }

  async findAll(businessId: string, params: PurchaseReturnQueryParams) {
    const {
      search,
      supplierId,
      purchaseId,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = params;
    const take = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(1, Number(page) || 1);
    const skip = (currentPage - 1) * take;

    const where: any = { businessId };

    if (purchaseId) where.purchaseId = purchaseId;

    if (supplierId) {
      where.purchase = { ...(where.purchase || {}), supplierId };
    }

    if (fromDate || toDate) {
      where.returnDate = {};
      if (fromDate) where.returnDate.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        where.returnDate.lte = end;
      }
    }

    if (status && status !== "All") {
      const normalized = status.toUpperCase().replace(/[\s-]/g, "_");
      if (normalized in PurchaseReturnStatus) {
        where.status = normalized as PurchaseReturnStatus;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { reason: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { debitNote: { noteNumber: { contains: q, mode: "insensitive" } } },
        { purchase: { purchaseNumber: { contains: q, mode: "insensitive" } } },
        {
          purchase: {
            supplierInvoiceNumber: { contains: q, mode: "insensitive" },
          },
        },
        { purchase: { supplier: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        skip,
        take,
        orderBy: { returnDate: "desc" },
        include: purchaseReturnInclude,
      }),
      prisma.purchaseReturn.count({ where }),
    ]);

    return {
      returns,
      total,
      page: currentPage,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async findById(businessId: string, id: string) {
    return prisma.purchaseReturn.findFirst({
      where: { id, businessId },
      include: purchaseReturnInclude,
    });
  }

  async create(
    businessId: string,
    data: {
      purchaseId: string;
      returnDate: Date;
      reason: string | null;
      notes: string | null;
      status: PurchaseReturnStatus;
      taxableValue: number;
      gstAmount: number;
      totalAmount: number;
      amountAdjusted: number;
      items: Array<{
        productId: string;
        productName: string | null;
        hsnCode: string | null;
        unit: string | null;
        quantity: number;
        rate: number;
        gstRatePercent: number;
        taxableValue: number;
        gstAmount: number;
        lineTotal: number;
        returnReason: string | null;
      }>;
      debitNoteNumber: string;
      supplierId: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.purchaseReturn.create({
        data: {
          businessId,
          purchaseId: data.purchaseId,
          returnDate: data.returnDate,
          reason: data.reason,
          notes: data.notes,
          status: data.status,
          taxableValue: data.taxableValue,
          gstAmount: data.gstAmount,
          totalAmount: data.totalAmount,
          amountAdjusted: data.amountAdjusted,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              hsnCode: item.hsnCode,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              gstRatePercent: item.gstRatePercent,
              taxableValue: item.taxableValue,
              gstAmount: item.gstAmount,
              lineTotal: item.lineTotal,
              returnReason: item.returnReason,
            })),
          },
          debitNote: {
            create: {
              businessId,
              noteNumber: data.debitNoteNumber,
              noteDate: data.returnDate,
              purchaseId: data.purchaseId,
              supplierId: data.supplierId,
              amount: data.totalAmount,
              reason: data.reason,
            },
          },
        },
        include: purchaseReturnInclude,
      });

      return created;
    });
  }

  async update(
    businessId: string,
    id: string,
    data: {
      returnDate: Date;
      reason: string | null;
      notes: string | null;
      status: PurchaseReturnStatus;
      taxableValue: number;
      gstAmount: number;
      totalAmount: number;
      amountAdjusted: number;
      items: Array<{
        productId: string;
        productName: string | null;
        hsnCode: string | null;
        unit: string | null;
        quantity: number;
        rate: number;
        gstRatePercent: number;
        taxableValue: number;
        gstAmount: number;
        lineTotal: number;
        returnReason: string | null;
      }>;
      debitNoteNumber?: string | null;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: id } });

      const updated = await tx.purchaseReturn.update({
        where: { id },
        data: {
          returnDate: data.returnDate,
          reason: data.reason,
          notes: data.notes,
          status: data.status,
          taxableValue: data.taxableValue,
          gstAmount: data.gstAmount,
          totalAmount: data.totalAmount,
          amountAdjusted: data.amountAdjusted,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              hsnCode: item.hsnCode,
              unit: item.unit,
              quantity: item.quantity,
              rate: item.rate,
              gstRatePercent: item.gstRatePercent,
              taxableValue: item.taxableValue,
              gstAmount: item.gstAmount,
              lineTotal: item.lineTotal,
              returnReason: item.returnReason,
            })),
          },
          debitNote: data.debitNoteNumber
            ? {
                update: {
                  noteNumber: data.debitNoteNumber,
                  noteDate: data.returnDate,
                  amount: data.totalAmount,
                  reason: data.reason,
                },
              }
            : {
                update: {
                  noteDate: data.returnDate,
                  amount: data.totalAmount,
                  reason: data.reason,
                },
              },
        },
        include: purchaseReturnInclude,
      });

      return updated;
    });
  }

  async confirmReturn(
    businessId: string,
    returnId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number; rate: number }>,
    purchase: { id: string; supplierId: string; purchaseNumber: string | null },
    totalAmount: number,
    debitNoteNumber: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const alreadyMoved = await tx.stockMovement.count({
        where: {
          businessId,
          referenceType: "PURCHASE_RETURN",
          referenceId: returnId,
        },
      });

      if (alreadyMoved === 0) {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              warehouseId,
              movementType: StockMovementType.PURCHASE_RETURN,
              quantity: -Math.abs(item.quantity),
              unitCost: item.rate,
              referenceType: "PURCHASE_RETURN",
              referenceId: returnId,
              movementDate: new Date(),
            },
          });
        }
      }

      const existingLedger = await tx.ledgerEntry.findFirst({
        where: {
          businessId,
          purchaseId: purchase.id,
          entryType: LedgerEntryType.DEBIT,
          particulars: { contains: returnId },
        },
      });

      if (!existingLedger) {
        await tx.ledgerEntry.create({
          data: {
            businessId,
            supplierId: purchase.supplierId,
            purchaseId: purchase.id,
            entryDate: new Date(),
            particulars: `Purchase Return / Debit Note ${debitNoteNumber || returnId} against ${purchase.purchaseNumber || purchase.id}`,
            entryType: LedgerEntryType.DEBIT,
            debitAmount: totalAmount,
            creditAmount: 0,
            runningBalance: 0,
            referenceNumber: debitNoteNumber || returnId,
          },
        });
      }

      return tx.purchaseReturn.update({
        where: { id: returnId },
        data: { status: PurchaseReturnStatus.CONFIRMED },
        include: purchaseReturnInclude,
      });
    });
  }

  async updateStatus(
    businessId: string,
    id: string,
    status: PurchaseReturnStatus,
    amountAdjusted?: number,
    notes?: string | null
  ) {
    return prisma.purchaseReturn.update({
      where: { id },
      data: {
        status,
        ...(amountAdjusted !== undefined ? { amountAdjusted } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: purchaseReturnInclude,
    });
  }

  async cancelReturn(
    businessId: string,
    returnId: string,
    reverseStock: boolean
  ) {
    return prisma.$transaction(async (tx) => {
      if (reverseStock) {
        const movements = await tx.stockMovement.findMany({
          where: {
            businessId,
            referenceType: "PURCHASE_RETURN",
            referenceId: returnId,
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
              referenceType: "PURCHASE_RETURN_CANCEL",
              referenceId: returnId,
            },
          });
        }
      }

      return tx.purchaseReturn.update({
        where: { id: returnId },
        data: {
          status: PurchaseReturnStatus.CANCELLED,
          amountAdjusted: 0,
        },
        include: purchaseReturnInclude,
      });
    });
  }

  async delete(businessId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.debitNote.deleteMany({ where: { purchaseReturnId: id, businessId } });
      await tx.purchaseReturn.delete({ where: { id } });
    });
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

  async getMetrics(businessId: string) {
    const [total, draft, confirmed, adjusted, refunded, cancelled, aggregates] =
      await Promise.all([
        prisma.purchaseReturn.count({ where: { businessId } }),
        prisma.purchaseReturn.count({
          where: { businessId, status: PurchaseReturnStatus.DRAFT },
        }),
        prisma.purchaseReturn.count({
          where: { businessId, status: PurchaseReturnStatus.CONFIRMED },
        }),
        prisma.purchaseReturn.count({
          where: { businessId, status: PurchaseReturnStatus.ADJUSTED },
        }),
        prisma.purchaseReturn.count({
          where: { businessId, status: PurchaseReturnStatus.REFUNDED },
        }),
        prisma.purchaseReturn.count({
          where: { businessId, status: PurchaseReturnStatus.CANCELLED },
        }),
        prisma.purchaseReturn.aggregate({
          where: {
            businessId,
            status: { not: PurchaseReturnStatus.CANCELLED },
          },
          _sum: { totalAmount: true, amountAdjusted: true, gstAmount: true },
        }),
      ]);

    const totalReturnValue = Number(aggregates._sum.totalAmount || 0);
    const adjustedAgainstBills = Number(aggregates._sum.amountAdjusted || 0);

    const pendingRows = await prisma.purchaseReturn.findMany({
      where: {
        businessId,
        status: {
          in: [PurchaseReturnStatus.DRAFT, PurchaseReturnStatus.CONFIRMED],
        },
      },
      select: { totalAmount: true, amountAdjusted: true },
    });

    const pendingRefunds = pendingRows.reduce((sum, row) => {
      return sum + Math.max(0, Number(row.totalAmount) - Number(row.amountAdjusted));
    }, 0);

    return {
      totalReturnsCount: total,
      draftCount: draft,
      confirmedCount: confirmed,
      adjustedCount: adjusted,
      refundedCount: refunded,
      cancelledCount: cancelled,
      totalReturnValue,
      adjustedAgainstBills,
      pendingRefunds,
      totalGst: Number(aggregates._sum.gstAmount || 0),
    };
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository();
