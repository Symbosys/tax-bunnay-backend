import { prisma } from "../../../../db/prisma";
import { ErrorResponse } from "../../../../utils/response.util";
import { receiptRepository, ReceiptRepository } from "../repo/receipt.repo";
import type { CreateReceiptInput, ReceiptQueryParams } from "../validators/receipt.validators";

export class ReceiptService {
  private repo: ReceiptRepository;

  constructor(repo: ReceiptRepository = receiptRepository) {
    this.repo = repo;
  }

  /**
   * Record a new customer receipt with multi-invoice allocations and ledger posting
   */
  async createReceipt(businessId: string, input: CreateReceiptInput) {
    // 1. Validate Customer exists and is active (with multi-tenant ID fallback)
    let customer = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId, isActive: true },
    });

    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { id: input.customerId, isActive: true },
      });
    }

    if (!customer) {
      throw new ErrorResponse("Customer not found or inactive", 404);
    }

    const effectiveBusinessId = customer.businessId || businessId;

    // Auto-generate reference number if not provided
    if (!input.referenceNumber || input.referenceNumber.trim().length === 0) {
      input.referenceNumber = await this.repo.generateNextReferenceNumber(effectiveBusinessId);
    }

    // 2. Validate invoice allocations (if any provided)
    if (input.allocations && input.allocations.length > 0) {
      const allocatedSum = input.allocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0
      );

      // Total allocated cannot exceed receipt amount (round to 2 decimals)
      if (Number(allocatedSum.toFixed(2)) > Number(input.amount.toFixed(2))) {
        throw new ErrorResponse(
          `Total allocated amount (₹${allocatedSum.toFixed(2)}) exceeds receipt amount (₹${input.amount.toFixed(2)})`,
          400
        );
      }

      const invoiceIds = input.allocations.map((a) => a.invoiceId);
      const invoices = await prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds },
          businessId: effectiveBusinessId,
          customerId: input.customerId,
          status: { not: "CANCELLED" },
        },
        include: {
          receiptAllocations: {
            select: { allocatedAmount: true },
          },
        },
      });

      if (invoices.length !== invoiceIds.length) {
        throw new ErrorResponse(
          "One or more allocated invoices were not found or do not belong to this customer",
          400
        );
      }

      // Check for over-allocation on individual invoices
      for (const alloc of input.allocations) {
        const inv = invoices.find((i) => i.id === alloc.invoiceId)!;
        const currentPaid = inv.receiptAllocations.reduce(
          (sum, a) => sum + Number(a.allocatedAmount),
          0
        );
        const grandTotal = Number(inv.grandTotal);
        const remainingBalance = Math.max(0, grandTotal - currentPaid);

        if (Number(alloc.allocatedAmount.toFixed(2)) > Number((remainingBalance + 0.01).toFixed(2))) {
          throw new ErrorResponse(
            `Allocated amount (₹${alloc.allocatedAmount.toFixed(2)}) for invoice ${inv.invoiceNumber} exceeds outstanding balance of ₹${remainingBalance.toFixed(2)}`,
            400
          );
        }
      }
    }

    return this.repo.createReceipt(effectiveBusinessId, input);
  }

  /**
   * List and search receipts with pagination
   */
  async getReceipts(businessId: string, params: ReceiptQueryParams) {
    return this.repo.findReceipts(businessId, params);
  }

  /**
   * Get single receipt details
   */
  async getReceiptById(businessId: string, id: string) {
    const receipt = await this.repo.findById(businessId, id);
    if (!receipt) {
      throw new ErrorResponse("Receipt not found", 404);
    }
    return receipt;
  }

  /**
   * Delete a receipt and restore invoice balances
   */
  async deleteReceipt(businessId: string, id: string) {
    const deleted = await this.repo.deleteReceipt(businessId, id);
    if (!deleted) {
      throw new ErrorResponse("Receipt not found or could not be deleted", 404);
    }
    return deleted;
  }

  /**
   * Fetch unpaid invoices for customer dropdown in UI
   */
  async getUnpaidInvoicesByCustomer(businessId: string, customerId: string) {
    // 1. First check scoped to businessId
    let customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });

    // 2. Fallback check across businesses by ID
    if (!customer) {
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
    }

    // 3. Return empty array [] if customer does not exist in DB (e.g. mock ID)
    if (!customer) {
      return [];
    }

    const effectiveBusinessId = customer.businessId || businessId;
    return this.repo.getUnpaidInvoicesByCustomer(effectiveBusinessId, customerId);
  }

  /**
   * Get receipt KPIs & metrics
   */
  async getMetrics(businessId: string) {
    return this.repo.getMetrics(businessId);
  }

  /**
   * Get next sequential receipt reference number / transaction ID
   */
  async getNextReferenceNumber(businessId: string) {
    const referenceNumber = await this.repo.generateNextReferenceNumber(businessId);
    return { referenceNumber };
  }
}

export const receiptService = new ReceiptService();
