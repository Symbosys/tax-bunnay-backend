import { prisma } from "../../../../db/prisma";
import type { SupplierQueryParams } from "../validators/supplier.validators";

export class SupplierRepository {
  /**
   * Create a new Supplier record linked to a Business
   */
  async create(businessId: string, data: any) {
    return prisma.supplier.create({
      data: {
        businessId,
        ...data,
      },
    });
  }

  /**
   * Find supplier by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.supplier.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        _count: {
          select: {
            purchases: true,
            payments: true,
            ledgerEntries: true,
            debitNotes: true,
          },
        },
      },
    });
  }

  /**
   * Find detailed supplier profile with recent transactions for SupplierDetailPage
   */
  async findDetailById(businessId: string, id: string) {
    return prisma.supplier.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        purchases: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            supplierInvoiceNumber: true,
            purchaseDate: true,
            paymentStatus: true,
            isConfirmed: true,
            totalAmount: true,
          },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            paymentDate: true,
            amount: true,
            paymentMode: true,
            referenceNumber: true,
          },
        },
        ledgerEntries: {
          take: 20,
          orderBy: { entryDate: "desc" },
          select: {
            id: true,
            entryDate: true,
            entryType: true,
            debitAmount: true,
            creditAmount: true,
            runningBalance: true,
            particulars: true,
            referenceNumber: true,
          },
        },
        _count: {
          select: {
            purchases: true,
            payments: true,
            ledgerEntries: true,
            debitNotes: true,
          },
        },
      },
    });
  }

  /**
   * Search, filter, and paginate suppliers for SupplierPage directory
   */
  async findAll(businessId: string, params: SupplierQueryParams) {
    const {
      search,
      supplierGroup,
      isRegistered,
      isActive,
      state,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: any = {
      businessId,
      isActive: isActive !== undefined ? isActive : true,
    };


    // Filter by GST registration status
    if (isRegistered === true) {
      where.gstin = { not: null };
    } else if (isRegistered === false) {
      where.OR = [{ gstin: null }, { gstin: "" }];
    }

    // Filter by State
    if (state) {
      where.state = {
        equals: state.trim(),
        mode: "insensitive",
      };
    }

    // Filter by Supplier Group ('General', 'Raw Material', etc.)
    if (supplierGroup && supplierGroup !== "All") {
      where.supplierGroup = {
        equals: supplierGroup.trim(),
        mode: "insensitive",
      };
    }

    // Search query matching Name, Mobile, GSTIN, or Email
    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { mobileNumber: { contains: q } },
        { gstin: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              purchases: true,
              payments: true,
            },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update Supplier record
   */
  async update(businessId: string, id: string, data: any) {
    return prisma.supplier.update({
      where: {
        id,
      },
      data,
    });
  }

  /**
   * Soft delete Supplier (set isActive: false)
   */
  async softDelete(businessId: string, id: string) {
    return prisma.supplier.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Hard delete Supplier
   */
  async delete(businessId: string, id: string) {
    return prisma.supplier.delete({
      where: {
        id,
      },
    });
  }

  /**
   * Check for duplicate GSTIN within the same Business
   */
  async findByGstin(businessId: string, gstin: string, excludeId?: string) {
    return prisma.supplier.findFirst({
      where: {
        businessId,
        gstin: {
          equals: gstin.toUpperCase().trim(),
          mode: "insensitive",
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * Check for duplicate mobile number within the same Business
   */
  async findByMobile(businessId: string, mobileNumber: string, excludeId?: string) {
    return prisma.supplier.findFirst({
      where: {
        businessId,
        mobileNumber: {
          equals: mobileNumber.trim(),
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * Check if supplier has associated financial transactions (purchases, payments, ledger entries, debit notes)
   */
  async countTransactions(businessId: string, id: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId },
      select: {
        _count: {
          select: {
            purchases: true,
            payments: true,
            ledgerEntries: true,
            debitNotes: true,
          },
        },
      },
    });

    if (!supplier) return 0;
    return (
      supplier._count.purchases +
      supplier._count.payments +
      supplier._count.ledgerEntries +
      supplier._count.debitNotes
    );
  }

  /**
   * Calculate supplier payable balance dynamically:
   * sum of purchases totalAmount - sum of payments amount
   */
  async calculateSupplierBalances(businessId: string, supplierIds: string[]) {
    if (supplierIds.length === 0) return new Map<string, number>();

    // 1. Purchases total per supplier
    const purchaseAggs = await prisma.purchase.groupBy({
      by: ["supplierId"],
      where: {
        businessId,
        supplierId: { in: supplierIds },
      },
      _sum: {
        totalAmount: true,
      },
    });

    // 2. Payments total per supplier
    const paymentAggs = await prisma.payment.groupBy({
      by: ["supplierId"],
      where: {
        businessId,
        supplierId: { in: supplierIds },
      },
      _sum: {
        amount: true,
      },
    });

    const purchaseMap = new Map<string, number>();
    for (const pur of purchaseAggs) {
      if (pur.supplierId) {
        purchaseMap.set(pur.supplierId, Number(pur._sum?.totalAmount ?? 0));
      }
    }

    const paymentMap = new Map<string, number>();
    for (const pay of paymentAggs) {
      if (pay.supplierId) {
        paymentMap.set(pay.supplierId, Number(pay._sum?.amount ?? 0));
      }
    }

    const balanceMap = new Map<string, number>();
    for (const id of supplierIds) {
      const purTotal = purchaseMap.get(id) ?? 0;
      const payTotal = paymentMap.get(id) ?? 0;
      balanceMap.set(id, purTotal - payTotal);
    }

    return balanceMap;
  }

  /**
   * High-level metrics for supplier directory dashboard
   */
  async getMetrics(businessId: string) {
    const [total, active, registered, openingAgg, purchaseAgg, paymentAgg] = await Promise.all([
      prisma.supplier.count({ where: { businessId, isActive: true } }),
      prisma.supplier.count({ where: { businessId, isActive: true } }),
      prisma.supplier.count({
        where: {
          businessId,
          isActive: true,
          gstin: { not: null },
        },
      }),
      prisma.supplier.aggregate({
        where: { businessId, isActive: true },
        _sum: {
          openingBalance: true,
        },
      }),
      prisma.purchase.aggregate({
        where: { businessId },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.payment.aggregate({
        where: { businessId },
        _sum: {
          amount: true,
        },
      }),
    ]);


    const totalOpening = Number(openingAgg._sum?.openingBalance ?? 0);
    const totalPurchased = Number(purchaseAgg._sum?.totalAmount ?? 0);
    const totalPaid = Number(paymentAgg._sum?.amount ?? 0);
    const totalPayable = totalOpening + totalPurchased - totalPaid;

    return {
      totalSuppliers: total,
      activeSuppliers: active,
      inactiveSuppliers: total - active,
      registeredSuppliers: registered,
      unregisteredSuppliers: total - registered,
      totalOpeningBalance: totalOpening,
      totalPurchased,
      totalPaid,
      totalPayable,
    };
  }
}

export const supplierRepo = new SupplierRepository();
