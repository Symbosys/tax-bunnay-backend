import { prisma } from "../../../../db/prisma";
import { PaymentStatus } from "../../../../generated/prisma/enums";

export class OutstandingRepository {
  /**
   * Fetch all active open customer invoices with allocations and customer credit terms
   */
  async findOpenInvoices(businessId: string, partyId?: string) {
    const where: any = {
      businessId,
      paymentStatus: { not: PaymentStatus.PAID },
      status: { not: "CANCELLED" },
    };

    if (partyId) {
      where.customerId = partyId;
    }

    return prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "asc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            email: true,
            creditPeriodDays: true,
          },
        },
        receiptAllocations: {
          select: {
            allocatedAmount: true,
          },
        },
      },
    });
  }

  /**
   * Fetch all active open supplier purchases with payments and supplier credit terms
   */
  async findOpenPurchases(businessId: string, partyId?: string) {
    const where: any = {
      businessId,
      paymentStatus: { not: PaymentStatus.PAID },
    };

    if (partyId) {
      where.supplierId = partyId;
    }

    return prisma.purchase.findMany({
      where,
      orderBy: { purchaseDate: "asc" },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            mobileNumber: true,
            email: true,
            creditTerms: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });
  }

  /**
   * Fetch recent ledger entries for a party to show history alongside outstanding
   */
  async getPartyLedgerEntries(businessId: string, type: "customer" | "supplier", partyId: string) {
    const where: any = { businessId };
    if (type === "customer") {
      where.customerId = partyId;
    } else {
      where.supplierId = partyId;
    }

    return prisma.ledgerEntry.findMany({
      where,
      orderBy: { entryDate: "desc" },
      take: 20,
    });
  }
}

export const outstandingRepository = new OutstandingRepository();
