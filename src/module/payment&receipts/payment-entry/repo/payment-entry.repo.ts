import { prisma } from "../../../../db/prisma";
import { LedgerEntryType, PaymentMode, PaymentStatus } from "../../../../generated/prisma/enums";
import type { CreatePaymentInput, PaymentQueryParams } from "../validators/payment-entry.validators";

export class PaymentEntryRepository {
  /**
   * Create a supplier payment with purchase allocation and ledger posting in a transaction
   */
  async createPayment(businessId: string, input: CreatePaymentInput) {
    return prisma.$transaction(async (tx) => {
      const refText = input.referenceNumber
        ? `Ref: ${input.referenceNumber}`
        : `PAY-${Date.now().toString().slice(-6)}`;

      let primaryPaymentId = "";

      // 1. If allocations are provided, record payments per allocated purchase
      if (input.allocations && input.allocations.length > 0) {
        const allocatedSum = input.allocations.reduce(
          (sum, a) => sum + a.amountAllocated,
          0
        );

        for (const alloc of input.allocations) {
          const payment = await tx.payment.create({
            data: {
              businessId,
              supplierId: input.supplierId,
              purchaseId: alloc.purchaseId,
              amount: alloc.amountAllocated,
              paymentDate: input.paymentDate,
              paymentMode: input.paymentMode as PaymentMode,
              referenceNumber: input.referenceNumber || null,
              notes: input.notes || null,
            },
          });

          if (!primaryPaymentId) {
            primaryPaymentId = payment.id;
          }

          // Recalculate total paid on this purchase
          const agg = await tx.payment.aggregate({
            where: { purchaseId: alloc.purchaseId },
            _sum: { amount: true },
          });

          const totalPaid = Number(agg._sum.amount || 0);
          const purchase = await tx.purchase.findUniqueOrThrow({
            where: { id: alloc.purchaseId },
            select: { id: true, totalAmount: true },
          });

          const totalAmount = Number(purchase.totalAmount);
          let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
          if (totalPaid >= totalAmount - 0.01) {
            paymentStatus = PaymentStatus.PAID;
          } else if (totalPaid > 0) {
            paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }

          await tx.purchase.update({
            where: { id: alloc.purchaseId },
            data: { paymentStatus },
          });
        }

        // Check if there is an unallocated on-account remainder
        const unallocatedRemainder = input.amount - allocatedSum;
        if (unallocatedRemainder > 0.01) {
          await tx.payment.create({
            data: {
              businessId,
              supplierId: input.supplierId,
              purchaseId: null,
              amount: unallocatedRemainder,
              paymentDate: input.paymentDate,
              paymentMode: input.paymentMode as PaymentMode,
              referenceNumber: input.referenceNumber || null,
              notes: input.notes ? `${input.notes} (On-Account remainder)` : "On-Account remainder",
            },
          });
        }
      } else {
        // Direct single payment (either tied to single purchaseId or purely on-account)
        const payment = await tx.payment.create({
          data: {
            businessId,
            supplierId: input.supplierId,
            purchaseId: input.purchaseId || null,
            amount: input.amount,
            paymentDate: input.paymentDate,
            paymentMode: input.paymentMode as PaymentMode,
            referenceNumber: input.referenceNumber || null,
            notes: input.notes || null,
          },
        });

        primaryPaymentId = payment.id;

        if (input.purchaseId) {
          const agg = await tx.payment.aggregate({
            where: { purchaseId: input.purchaseId },
            _sum: { amount: true },
          });

          const totalPaid = Number(agg._sum.amount || 0);
          const purchase = await tx.purchase.findUniqueOrThrow({
            where: { id: input.purchaseId },
            select: { id: true, totalAmount: true },
          });

          const totalAmount = Number(purchase.totalAmount);
          let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
          if (totalPaid >= totalAmount - 0.01) {
            paymentStatus = PaymentStatus.PAID;
          } else if (totalPaid > 0) {
            paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }

          await tx.purchase.update({
            where: { id: input.purchaseId },
            data: { paymentStatus },
          });
        }
      }

      // 2. Create supplier ledger DEBIT entry (money paid decreases supplier payable)
      await tx.ledgerEntry.create({
        data: {
          businessId,
          supplierId: input.supplierId,
          paymentId: primaryPaymentId,
          purchaseId: input.purchaseId || null,
          entryDate: input.paymentDate,
          particulars: `Payment made via ${input.paymentMode} (${refText})`,
          entryType: LedgerEntryType.DEBIT,
          debitAmount: input.amount,
          creditAmount: 0,
          runningBalance: 0,
          referenceNumber: input.referenceNumber || null,
        },
      });

      // 3. Return primary payment details
      return tx.payment.findUniqueOrThrow({
        where: { id: primaryPaymentId },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              gstin: true,
              state: true,
            },
          },
          purchase: {
            select: {
              id: true,
              supplierInvoiceNumber: true,
              purchaseDate: true,
              totalAmount: true,
              paymentStatus: true,
            },
          },
          ledgerEntries: true,
        },
      });
    });
  }

  /**
   * List paginated supplier payments with filtering
   */
  async findPayments(businessId: string, params: PaymentQueryParams) {
    const { page, limit, search, supplierId, paymentMode, startDate, endDate, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;

    const where: any = { businessId };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = startDate;
      if (endDate) where.paymentDate.lte = endDate;
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { supplier: { mobileNumber: { contains: q } } },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              gstin: true,
              state: true,
            },
          },
          purchase: {
            select: {
              id: true,
              supplierInvoiceNumber: true,
              purchaseDate: true,
              totalAmount: true,
              paymentStatus: true,
            },
          },
        },
      }),
    ]);

    return {
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find payment by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.payment.findFirst({
      where: { id, businessId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            gstin: true,
            state: true,
            address: true,
          },
        },
        purchase: {
          select: {
            id: true,
            supplierInvoiceNumber: true,
            purchaseDate: true,
            totalAmount: true,
            paymentStatus: true,
          },
        },
        ledgerEntries: true,
      },
    });
  }

  /**
   * Delete payment, revert purchase payment status, and remove ledger entry
   */
  async deletePayment(businessId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, businessId },
      });

      if (!payment) return null;

      // 1. Delete associated ledger entries
      await tx.ledgerEntry.deleteMany({
        where: { paymentId: id, businessId },
      });

      // 2. Delete payment
      await tx.payment.delete({
        where: { id },
      });

      // 3. Recalculate purchase status if linked
      if (payment.purchaseId) {
        const agg = await tx.payment.aggregate({
          where: { purchaseId: payment.purchaseId },
          _sum: { amount: true },
        });

        const totalPaid = Number(agg._sum.amount || 0);
        const purchase = await tx.purchase.findUnique({
          where: { id: payment.purchaseId },
          select: { totalAmount: true },
        });

        if (purchase) {
          const totalAmount = Number(purchase.totalAmount);
          let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
          if (totalPaid >= totalAmount - 0.01) {
            paymentStatus = PaymentStatus.PAID;
          } else if (totalPaid > 0) {
            paymentStatus = PaymentStatus.PARTIALLY_PAID;
          }

          await tx.purchase.update({
            where: { id: payment.purchaseId },
            data: { paymentStatus },
          });
        }
      }

      return payment;
    });
  }

  /**
   * Fetch open/unpaid/partially-paid purchases for a supplier
   * (Powers PaymentEntryPage bill allocation table)
   */
  async getUnpaidPurchasesBySupplier(businessId: string, supplierId: string) {
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        supplierId,
        paymentStatus: { not: PaymentStatus.PAID },
      },
      orderBy: { purchaseDate: "asc" },
      include: {
        payments: {
          select: { amount: true },
        },
      },
    });

    return purchases
      .map((p) => {
        const totalAmount = Number(p.totalAmount);
        const paidAmount = p.payments.reduce(
          (sum, pay) => sum + Number(pay.amount),
          0
        );
        const balanceAmount = Math.max(0, totalAmount - paidAmount);

        return {
          id: p.id,
          purchaseNumber: p.supplierInvoiceNumber || `PUR-${p.id.slice(-6).toUpperCase()}`,
          supplierInvoiceNumber: p.supplierInvoiceNumber,
          purchaseDate: p.purchaseDate,
          totalAmount,
          paidAmount: Number(paidAmount.toFixed(2)),
          balanceAmount: Number(balanceAmount.toFixed(2)),
          paymentStatus: p.paymentStatus,
        };
      })
      .filter((p) => p.balanceAmount > 0);
  }

  /**
   * High-level payment metrics
   */
  async getMetrics(businessId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, totalAgg, countTotal] = await Promise.all([
      prisma.payment.aggregate({
        where: { businessId, paymentDate: { gte: startOfToday } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { businessId, paymentDate: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { businessId },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { businessId } }),
    ]);

    return {
      todayPaid: Number(todayAgg._sum.amount || 0),
      todayCount: todayAgg._count.id || 0,
      thisMonthPaid: Number(monthAgg._sum.amount || 0),
      thisMonthCount: monthAgg._count.id || 0,
      totalPaid: Number(totalAgg._sum.amount || 0),
      totalPayments: countTotal,
    };
  }

  /**
   * Generate next sequential payment reference code (e.g. PAY-20260907-0001)
   */
  async generateNextReferenceNumber(businessId: string): Promise<string> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const prefix = `PAY-${yyyy}${mm}${dd}-`;

    const countToday = await prisma.payment.count({
      where: {
        businessId,
        referenceNumber: { startsWith: prefix },
      },
    });

    const seq = String(countToday + 1).padStart(4, "0");
    return `${prefix}${seq}`;
  }
}

export const paymentEntryRepository = new PaymentEntryRepository();
