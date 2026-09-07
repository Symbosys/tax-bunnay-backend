import { prisma } from "../../../../db/prisma";
import { ErrorResponse } from "../../../../utils/response.util";
import { paymentEntryRepository, PaymentEntryRepository } from "../repo/payment-entry.repo";
import type { CreatePaymentInput, PaymentQueryParams } from "../validators/payment-entry.validators";

export class PaymentEntryService {
  private repo: PaymentEntryRepository;

  constructor(repo: PaymentEntryRepository = paymentEntryRepository) {
    this.repo = repo;
  }

  /**
   * Record a new supplier payment with validation
   */
  async createPayment(businessId: string, input: CreatePaymentInput) {
    // 1. Validate Supplier exists and is active (with multi-tenant ID fallback)
    let supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, businessId, isActive: true },
    });

    if (!supplier) {
      supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, isActive: true },
      });
    }

    if (!supplier) {
      throw new ErrorResponse("Supplier not found or inactive", 404);
    }

    const effectiveBusinessId = supplier.businessId || businessId;

    // Auto-generate reference number if not provided
    if (!input.referenceNumber || input.referenceNumber.trim().length === 0) {
      input.referenceNumber = await this.repo.generateNextReferenceNumber(effectiveBusinessId);
    }

    // 2. Validate allocations if provided
    if (input.allocations && input.allocations.length > 0) {
      const allocatedSum = input.allocations.reduce(
        (sum, a) => sum + a.amountAllocated,
        0
      );

      if (Number(allocatedSum.toFixed(2)) > Number(input.amount.toFixed(2))) {
        throw new ErrorResponse(
          `Total allocated amount (₹${allocatedSum.toFixed(2)}) exceeds payment amount (₹${input.amount.toFixed(2)})`,
          400
        );
      }

      const purchaseIds = input.allocations.map((a) => a.purchaseId);
      const purchases = await prisma.purchase.findMany({
        where: {
          id: { in: purchaseIds },
          businessId,
          supplierId: input.supplierId,
        },
        include: {
          payments: {
            select: { amount: true },
          },
        },
      });

      if (purchases.length !== purchaseIds.length) {
        throw new ErrorResponse(
          "One or more allocated purchase bills were not found or do not belong to this supplier",
          400
        );
      }

      // Check for over-allocation on individual purchases
      for (const alloc of input.allocations) {
        const pur = purchases.find((p) => p.id === alloc.purchaseId)!;
        const currentPaid = pur.payments.reduce(
          (sum, pay) => sum + Number(pay.amount),
          0
        );
        const totalAmount = Number(pur.totalAmount);
        const remainingBalance = Math.max(0, totalAmount - currentPaid);

        if (Number(alloc.amountAllocated.toFixed(2)) > Number((remainingBalance + 0.01).toFixed(2))) {
          throw new ErrorResponse(
            `Allocated amount (₹${alloc.amountAllocated.toFixed(2)}) for bill ${pur.supplierInvoiceNumber || pur.id.slice(-6)} exceeds outstanding balance of ₹${remainingBalance.toFixed(2)}`,
            400
          );
        }
      }
    } else if (input.purchaseId) {
      // Single purchase validation
      const purchase = await prisma.purchase.findFirst({
        where: {
          id: input.purchaseId,
          businessId,
          supplierId: input.supplierId,
        },
        include: {
          payments: { select: { amount: true } },
        },
      });

      if (!purchase) {
        throw new ErrorResponse(
          "Purchase bill not found or does not belong to this supplier",
          404
        );
      }

      const currentPaid = purchase.payments.reduce(
        (sum, pay) => sum + Number(pay.amount),
        0
      );
      const totalAmount = Number(purchase.totalAmount);
      const remainingBalance = Math.max(0, totalAmount - currentPaid);

      if (Number(input.amount.toFixed(2)) > Number((remainingBalance + 0.01).toFixed(2))) {
        throw new ErrorResponse(
          `Payment amount (₹${input.amount.toFixed(2)}) exceeds bill outstanding balance of ₹${remainingBalance.toFixed(2)}`,
          400
        );
      }
    }

    return this.repo.createPayment(businessId, input);
  }

  /**
   * List and filter payments
   */
  async getPayments(businessId: string, params: PaymentQueryParams) {
    return this.repo.findPayments(businessId, params);
  }

  /**
   * Get single payment by ID
   */
  async getPaymentById(businessId: string, id: string) {
    const payment = await this.repo.findById(businessId, id);
    if (!payment) {
      throw new ErrorResponse("Payment record not found", 404);
    }
    return payment;
  }

  /**
   * Delete a payment
   */
  async deletePayment(businessId: string, id: string) {
    const deleted = await this.repo.deletePayment(businessId, id);
    if (!deleted) {
      throw new ErrorResponse("Payment not found or could not be deleted", 404);
    }
    return deleted;
  }

  /**
   * Fetch unpaid purchases for supplier bill allocation dropdown in UI
   */
  async getUnpaidPurchasesBySupplier(businessId: string, supplierId: string) {
    // 1. First look up supplier scoped to active business
    let supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    // 2. If not found scoped to businessId, check if supplier exists across businesses (multi-tenant fallback)
    if (!supplier) {
      supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
    }

    // 3. If supplier does not exist in the database (e.g. local mock ID or deleted),
    // return empty array [] gracefully so UI displays 0 unpaid bills instead of 404 crash
    if (!supplier) {
      return [];
    }

    const effectiveBusinessId = supplier.businessId || businessId;
    return this.repo.getUnpaidPurchasesBySupplier(effectiveBusinessId, supplierId);
  }

  /**
   * Get payment KPI metrics
   */
  async getMetrics(businessId: string) {
    return this.repo.getMetrics(businessId);
  }

  /**
   * Get next sequential payment reference code / transaction ID
   */
  async getNextReferenceNumber(businessId: string) {
    const referenceNumber = await this.repo.generateNextReferenceNumber(businessId);
    return { referenceNumber };
  }
}

export const paymentEntryService = new PaymentEntryService();
