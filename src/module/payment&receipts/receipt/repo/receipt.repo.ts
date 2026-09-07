import { prisma } from "../../../../db/prisma";
import { LedgerEntryType, PaymentMode, PaymentStatus } from "../../../../generated/prisma/enums";
import type { CreateReceiptInput, ReceiptQueryParams } from "../validators/receipt.validators";

export class ReceiptRepository {
  /**
   * Create a customer receipt with optional multi-invoice allocations and ledger posting in a transaction
   */
  async createReceipt(businessId: string, input: CreateReceiptInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Receipt header
      const receipt = await tx.receipt.create({
        data: {
          businessId,
          customerId: input.customerId,
          amount: input.amount,
          receiptDate: input.receiptDate,
          paymentMode: input.paymentMode as PaymentMode,
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null,
        },
      });

      // 2. Create Allocations & update each affected invoice status
      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          await tx.receiptAllocation.create({
            data: {
              receiptId: receipt.id,
              invoiceId: alloc.invoiceId,
              allocatedAmount: alloc.allocatedAmount,
            },
          });

          // Recalculate total allocated against this invoice
          const agg = await tx.receiptAllocation.aggregate({
            where: { invoiceId: alloc.invoiceId },
            _sum: { allocatedAmount: true },
          });

          const totalAllocated = Number(agg._sum.allocatedAmount || 0);
          const invoice = await tx.invoice.findUniqueOrThrow({
            where: { id: alloc.invoiceId },
            select: { id: true, grandTotal: true },
          });

          const grandTotal = Number(invoice.grandTotal);
          let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
          if (totalAllocated >= grandTotal - 0.01) {
            paymentStatus = PaymentStatus.PAID;
          } else if (totalAllocated > 0) {
            paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }

          await tx.invoice.update({
            where: { id: alloc.invoiceId },
            data: { paymentStatus },
          });
        }
      }

      // 3. Post party ledger CREDIT entry (money received decreases customer receivable)
      const refText = input.referenceNumber
        ? `Ref: ${input.referenceNumber}`
        : `REC-${receipt.id.slice(-6).toUpperCase()}`;

      await tx.ledgerEntry.create({
        data: {
          businessId,
          customerId: input.customerId,
          receiptId: receipt.id,
          entryDate: input.receiptDate,
          particulars: `Payment received via ${input.paymentMode} (${refText})`,
          entryType: LedgerEntryType.CREDIT,
          creditAmount: input.amount,
          debitAmount: 0,
          runningBalance: 0,
          referenceNumber: input.referenceNumber || null,
        },
      });

      // 4. Return complete receipt object with relations
      return tx.receipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              gstin: true,
              state: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  invoiceDate: true,
                  grandTotal: true,
                  paymentStatus: true,
                },
              },
            },
          },
          ledgerEntries: true,
        },
      });
    });
  }

  /**
   * Find paginated receipts with search and filter support
   */
  async findReceipts(businessId: string, params: ReceiptQueryParams) {
    const { page, limit, search, customerId, paymentMode, startDate, endDate, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode;
    }

    if (startDate || endDate) {
      where.receiptDate = {};
      if (startDate) where.receiptDate.gte = startDate;
      if (endDate) where.receiptDate.lte = endDate;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { mobileNumber: { contains: q } } },
      ];
    }

    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              gstin: true,
              state: true,
            },
          },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  invoiceDate: true,
                  grandTotal: true,
                  paymentStatus: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      receipts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find receipt by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.receipt.findFirst({
      where: { id, businessId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            gstin: true,
            state: true,
            billingAddress: true,
          },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                invoiceDate: true,
                grandTotal: true,
                paymentStatus: true,
              },
            },
          },
        },
        ledgerEntries: true,
      },
    });
  }

  /**
   * Delete a receipt, revert invoice payment statuses, and remove ledger entry
   */
  async deleteReceipt(businessId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findFirst({
        where: { id, businessId },
        include: { allocations: true },
      });

      if (!receipt) return null;

      const affectedInvoiceIds = receipt.allocations.map((a) => a.invoiceId);

      // 1. Delete ledger entries
      await tx.ledgerEntry.deleteMany({
        where: { receiptId: id, businessId },
      });

      // 2. Delete receipt (cascades receipt_allocations)
      await tx.receipt.delete({
        where: { id },
      });

      // 3. Recalculate status of affected invoices
      for (const invId of affectedInvoiceIds) {
        const agg = await tx.receiptAllocation.aggregate({
          where: { invoiceId: invId },
          _sum: { allocatedAmount: true },
        });

        const totalAllocated = Number(agg._sum.allocatedAmount || 0);
        const invoice = await tx.invoice.findUnique({
          where: { id: invId },
          select: { grandTotal: true },
        });

        if (invoice) {
          const grandTotal = Number(invoice.grandTotal);
          let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
          if (totalAllocated >= grandTotal - 0.01) {
            paymentStatus = PaymentStatus.PAID;
          } else if (totalAllocated > 0) {
            paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }

          await tx.invoice.update({
            where: { id: invId },
            data: { paymentStatus },
          });
        }
      }

      return receipt;
    });
  }

  /**
   * Fetch all open/unpaid/partially-paid invoices for a customer to populate
   * the bill allocation table in ReceiptEntryPage
   */
  async getUnpaidInvoicesByCustomer(businessId: string, customerId: string) {
    const invoices = await prisma.invoice.findMany({
      where: {
        businessId,
        customerId,
        paymentStatus: { not: PaymentStatus.PAID },
        status: { not: "CANCELLED" },
      },
      orderBy: { invoiceDate: "asc" }, // Oldest invoices first
      include: {
        receiptAllocations: {
          select: { allocatedAmount: true },
        },
      },
    });

    return invoices
      .map((inv) => {
        const grandTotal = Number(inv.grandTotal);
        const paidAmount = inv.receiptAllocations.reduce(
          (sum, a) => sum + Number(a.allocatedAmount),
          0
        );
        const balanceAmount = Math.max(0, grandTotal - paidAmount);

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          grandTotal,
          paidAmount: Number(paidAmount.toFixed(2)),
          balanceAmount: Number(balanceAmount.toFixed(2)),
          paymentStatus: inv.paymentStatus,
        };
      })
      .filter((inv) => inv.balanceAmount > 0);
  }

  /**
   * Get high-level receipt metrics for the business
   */
  async getMetrics(businessId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, totalAgg, countTotal] = await Promise.all([
      prisma.receipt.aggregate({
        where: { businessId, receiptDate: { gte: startOfToday } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.receipt.aggregate({
        where: { businessId, receiptDate: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.receipt.aggregate({
        where: { businessId },
        _sum: { amount: true },
      }),
      prisma.receipt.count({ where: { businessId } }),
    ]);

    return {
      todayReceived: Number(todayAgg._sum.amount || 0),
      todayCount: todayAgg._count.id || 0,
      thisMonthReceived: Number(monthAgg._sum.amount || 0),
      thisMonthCount: monthAgg._count.id || 0,
      totalReceived: Number(totalAgg._sum.amount || 0),
      totalReceipts: countTotal,
    };
  }

  /**
   * Generate next sequential receipt reference number (e.g. REC-20260907-0001)
   */
  async generateNextReferenceNumber(businessId: string): Promise<string> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const prefix = `REC-${yyyy}${mm}${dd}-`;

    const countToday = await prisma.receipt.count({
      where: {
        businessId,
        referenceNumber: { startsWith: prefix },
      },
    });

    const seq = String(countToday + 1).padStart(4, "0");
    return `${prefix}${seq}`;
  }
}

export const receiptRepository = new ReceiptRepository();
