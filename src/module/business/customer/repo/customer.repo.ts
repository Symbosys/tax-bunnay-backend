import { prisma } from "../../../../db/prisma";
import type { CustomerQueryParams } from "../validators/customer.validators";

export class CustomerRepository {
  /**
   * Create a new Customer record linked to a Business
   */
  async create(businessId: string, data: any) {
    return prisma.customer.create({
      data: {
        businessId,
        ...data,
      },
    });
  }

  /**
   * Find customer by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        _count: {
          select: {
            invoices: true,
            receipts: true,
            ledgerEntries: true,
            creditNotes: true,
          },
        },
      },
    });
  }

  /**
   * Find detailed customer profile with recent transactions for CustomerDetailPage
   */
  async findDetailById(businessId: string, id: string) {
    return prisma.customer.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        invoices: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            status: true,
            paymentStatus: true,
            paymentMode: true,
            grandTotal: true,
          },
        },
        receipts: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            receiptDate: true,
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
            invoices: true,
            receipts: true,
            ledgerEntries: true,
            creditNotes: true,
          },
        },
      },
    });
  }

  /**
   * Search, filter, and paginate customers for CustomerPage directory
   */
  async findAll(businessId: string, params: CustomerQueryParams) {
    const {
      search,
      customerGroup,
      type,
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
    if (isRegistered !== undefined) {
      where.isRegistered = isRegistered;
    }

    // Filter by State
    if (state) {
      where.state = {
        equals: state.trim(),
        mode: "insensitive",
      };
    }

    // Filter by Customer Group / Type ('Retail', 'Wholesale', etc.)
    const groupFilter = customerGroup || type;
    if (groupFilter && groupFilter !== "All") {
      where.customerGroup = {
        equals: groupFilter.trim(),
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

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              invoices: true,
              receipts: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update Customer record
   */
  async update(businessId: string, id: string, data: any) {
    return prisma.customer.update({
      where: {
        id,
      },
      data,
    });
  }

  /**
   * Soft delete Customer (set isActive: false)
   */
  async softDelete(businessId: string, id: string) {
    return prisma.customer.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Hard delete Customer
   */
  async delete(businessId: string, id: string) {
    return prisma.customer.delete({
      where: {
        id,
      },
    });
  }

  /**
   * Check for duplicate GSTIN within the same Business
   */
  async findByGstin(businessId: string, gstin: string, excludeId?: string) {
    return prisma.customer.findFirst({
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
    return prisma.customer.findFirst({
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
   * Check if customer has associated financial transactions (invoices, receipts, ledger entries)
   */
  async countTransactions(businessId: string, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, businessId },
      select: {
        _count: {
          select: {
            invoices: true,
            receipts: true,
            ledgerEntries: true,
            creditNotes: true,
          },
        },
      },
    });

    if (!customer) return 0;
    return (
      customer._count.invoices +
      customer._count.receipts +
      customer._count.ledgerEntries +
      customer._count.creditNotes
    );
  }

  /**
   * Calculate customer outstanding balance dynamically:
   * sum of invoices grandTotal - sum of receipts amount
   */
  async calculateCustomerBalances(businessId: string, customerIds: string[]) {
    if (customerIds.length === 0) return new Map<string, number>();

    // 1. Invoices total per customer
    const invoiceAggs = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        businessId,
        customerId: { in: customerIds },
        status: { notIn: ["CANCELLED"] },
      },
      _sum: {
        grandTotal: true,
      },
    });

    // 2. Receipts total per customer
    const receiptAggs = await prisma.receipt.groupBy({
      by: ["customerId"],
      where: {
        businessId,
        customerId: { in: customerIds },
      },
      _sum: {
        amount: true,
      },
    });

    const invoiceMap = new Map<string, number>();
    for (const inv of invoiceAggs) {
      if (inv.customerId) {
        invoiceMap.set(inv.customerId, Number(inv._sum?.grandTotal ?? 0));
      }
    }

    const receiptMap = new Map<string, number>();
    for (const rec of receiptAggs) {
      if (rec.customerId) {
        receiptMap.set(rec.customerId, Number(rec._sum?.amount ?? 0));
      }
    }

    const balanceMap = new Map<string, number>();
    for (const id of customerIds) {
      const invTotal = invoiceMap.get(id) ?? 0;
      const recTotal = receiptMap.get(id) ?? 0;
      balanceMap.set(id, invTotal - recTotal);
    }

    return balanceMap;
  }

  /**
   * High-level metrics for customer directory dashboard
   */
  async getMetrics(businessId: string) {
    const [total, active, registered, openingAgg, invoiceAgg, receiptAgg] = await Promise.all([
      prisma.customer.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.customer.count({ where: { businessId, isRegistered: true } }),
      prisma.customer.aggregate({
        where: { businessId },
        _sum: {
          openingBalance: true,
        },
      }),
      prisma.invoice.aggregate({
        where: {
          businessId,
          status: { notIn: ["CANCELLED"] },
        },
        _sum: {
          grandTotal: true,
        },
      }),
      prisma.receipt.aggregate({
        where: { businessId },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const totalOpening = Number(openingAgg._sum?.openingBalance ?? 0);
    const totalInvoiced = Number(invoiceAgg._sum?.grandTotal ?? 0);
    const totalReceived = Number(receiptAgg._sum?.amount ?? 0);
    const totalOutstanding = totalOpening + totalInvoiced - totalReceived;

    return {
      totalCustomers: total,
      activeCustomers: active,
      inactiveCustomers: total - active,
      registeredCustomers: registered,
      unregisteredCustomers: total - registered,
      totalOpeningBalance: totalOpening,
      totalInvoiced,
      totalReceived,
      totalReceivables: totalOutstanding,
    };
  }
}

export const customerRepo = new CustomerRepository();
