import { outstandingRepository, OutstandingRepository } from "../repo/outstanding.repo";
import type { OutstandingQueryParams } from "../validators/outstanding.validators";

export interface OutstandingItem {
  id: string;
  refNumber: string;
  date: Date;
  dueDate: Date;
  partyId: string;
  partyName: string;
  partyMobile?: string | null;
  amount: number;
  paidAmount: number;
  balance: number;
  ageDays: number;
  statusLabel: "OVERDUE" | "DUE TODAY" | "PENDING";
  bucket: "0-30" | "31-60" | "61-90" | "91+";
}

export class OutstandingService {
  private repo: OutstandingRepository;

  constructor(repo: OutstandingRepository = outstandingRepository) {
    this.repo = repo;
  }

  /**
   * Helper to parse credit days from a supplier string like "30 Days", "Net 45", or integer
   */
  private parseCreditTerms(terms?: string | null): number {
    if (!terms) return 30;
    const match = terms.match(/\d+/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      return parsed > 0 ? parsed : 30;
    }
    return 30;
  }

  /**
   * Helper to determine same day
   */
  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Helper to classify ageing bucket by calendar days
   */
  private getAgeingBucket(days: number): "0-30" | "31-60" | "61-90" | "91+" {
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    if (days <= 90) return "61-90";
    return "91+";
  }

  /**
   * Get high-level KPI and Ageing summary for both Receivables and Payables
   */
  async getSummary(businessId: string) {
    const now = new Date();

    const [invoices, purchases] = await Promise.all([
      this.repo.findOpenInvoices(businessId),
      this.repo.findOpenPurchases(businessId),
    ]);

    // 1. Process Receivables
    let recTotal = 0;
    let recDueToday = 0;
    let recOverdue = 0;
    let recPending = 0;
    let recB0_30 = 0;
    let recB31_60 = 0;
    let recB61_90 = 0;
    let recB91Plus = 0;
    let recCount = 0;

    for (const inv of invoices) {
      const grandTotal = Number(inv.grandTotal);
      const paid = inv.receiptAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
      const balance = Math.max(0, grandTotal - paid);

      if (balance <= 0.009) continue;
      recCount++;

      const invDate = new Date(inv.invoiceDate);
      const diffDays = Math.max(0, Math.floor((now.getTime() - invDate.getTime()) / (1000 * 3600 * 24)));
      const creditDays = inv.customer?.creditPeriodDays && inv.customer.creditPeriodDays > 0 ? inv.customer.creditPeriodDays : 30;
      const dueDate = new Date(invDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

      const isDueToday = this.isSameDay(now, dueDate);
      const isOverdue = now > dueDate && !isDueToday;

      recTotal += balance;
      if (isDueToday) recDueToday += balance;
      else if (isOverdue) recOverdue += balance;
      else recPending += balance;

      if (diffDays <= 30) recB0_30 += balance;
      else if (diffDays <= 60) recB31_60 += balance;
      else if (diffDays <= 90) recB61_90 += balance;
      else recB91Plus += balance;
    }

    // 2. Process Payables
    let payTotal = 0;
    let payDueToday = 0;
    let payOverdue = 0;
    let payPending = 0;
    let payB0_30 = 0;
    let payB31_60 = 0;
    let payB61_90 = 0;
    let payB91Plus = 0;
    let payCount = 0;

    for (const p of purchases) {
      const totalAmount = Number(p.totalAmount);
      const paid = p.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
      const balance = Math.max(0, totalAmount - paid);

      if (balance <= 0.009) continue;
      payCount++;

      const purDate = new Date(p.purchaseDate);
      const diffDays = Math.max(0, Math.floor((now.getTime() - purDate.getTime()) / (1000 * 3600 * 24)));
      const creditDays = this.parseCreditTerms(p.supplier?.creditTerms);
      const dueDate = new Date(purDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

      const isDueToday = this.isSameDay(now, dueDate);
      const isOverdue = now > dueDate && !isDueToday;

      payTotal += balance;
      if (isDueToday) payDueToday += balance;
      else if (isOverdue) payOverdue += balance;
      else payPending += balance;

      if (diffDays <= 30) payB0_30 += balance;
      else if (diffDays <= 60) payB31_60 += balance;
      else if (diffDays <= 90) payB61_90 += balance;
      else payB91Plus += balance;
    }

    return {
      receivables: {
        totalOutstanding: Number(recTotal.toFixed(2)),
        dueToday: Number(recDueToday.toFixed(2)),
        totalOverdue: Number(recOverdue.toFixed(2)),
        totalPending: Number(recPending.toFixed(2)),
        count: recCount,
        ageingBuckets: {
          bucket0To30: Number(recB0_30.toFixed(2)),
          bucket31To60: Number(recB31_60.toFixed(2)),
          bucket61To90: Number(recB61_90.toFixed(2)),
          bucket91Plus: Number(recB91Plus.toFixed(2)),
        },
      },
      payables: {
        totalOutstanding: Number(payTotal.toFixed(2)),
        dueToday: Number(payDueToday.toFixed(2)),
        totalOverdue: Number(payOverdue.toFixed(2)),
        totalPending: Number(payPending.toFixed(2)),
        count: payCount,
        ageingBuckets: {
          bucket0To30: Number(payB0_30.toFixed(2)),
          bucket31To60: Number(payB31_60.toFixed(2)),
          bucket61To90: Number(payB61_90.toFixed(2)),
          bucket91Plus: Number(payB91Plus.toFixed(2)),
        },
      },
      netWorkingCapital: Number((recTotal - payTotal).toFixed(2)),
    };
  }

  /**
   * Detailed Receivables list matching OutstandingPage
   */
  async getReceivables(businessId: string, params: OutstandingQueryParams) {
    const now = new Date();
    const invoices = await this.repo.findOpenInvoices(businessId, params.partyId);

    let items: OutstandingItem[] = [];

    for (const inv of invoices) {
      const grandTotal = Number(inv.grandTotal);
      const paid = inv.receiptAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
      const balance = Math.max(0, grandTotal - paid);

      if (balance <= 0.009) continue;

      const invDate = new Date(inv.invoiceDate);
      const diffDays = Math.max(0, Math.floor((now.getTime() - invDate.getTime()) / (1000 * 3600 * 24)));
      const creditDays = inv.customer?.creditPeriodDays && inv.customer.creditPeriodDays > 0 ? inv.customer.creditPeriodDays : 30;
      const dueDate = new Date(invDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

      const isDueToday = this.isSameDay(now, dueDate);
      const isOverdue = now > dueDate && !isDueToday;
      const statusLabel: "OVERDUE" | "DUE TODAY" | "PENDING" = isOverdue
        ? "OVERDUE"
        : isDueToday
        ? "DUE TODAY"
        : "PENDING";
      const bucket = this.getAgeingBucket(diffDays);

      items.push({
        id: inv.id,
        refNumber: inv.invoiceNumber,
        date: inv.invoiceDate,
        dueDate,
        partyId: inv.customerId,
        partyName: inv.customer?.name || "Customer",
        partyMobile: inv.customer?.mobileNumber,
        amount: grandTotal,
        paidAmount: Number(paid.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        ageDays: diffDays,
        statusLabel,
        bucket,
      });
    }

    // Filters
    if (params.status && params.status !== "ALL") {
      items = items.filter((i) => i.statusLabel === params.status);
    }

    if (params.bucket && params.bucket !== "ALL") {
      items = items.filter((i) => i.bucket === params.bucket);
    }

    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.partyName.toLowerCase().includes(q) ||
          i.refNumber.toLowerCase().includes(q) ||
          (i.partyMobile && i.partyMobile.includes(q))
      );
    }

    // Sort
    const { sortBy, sortOrder } = params;
    items.sort((a: any, b: any) => {
      let vA = a[sortBy];
      let vB = b[sortBy];

      if (vA instanceof Date) vA = vA.getTime();
      if (vB instanceof Date) vB = vB.getTime();

      if (typeof vA === "string") {
        return sortOrder === "asc" ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortOrder === "asc" ? vA - vB : vB - vA;
    });

    const total = items.length;
    const skip = (params.page - 1) * params.limit;
    const paginatedItems = items.slice(skip, skip + params.limit);

    return {
      items: paginatedItems,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  /**
   * Detailed Payables list matching OutstandingPage
   */
  async getPayables(businessId: string, params: OutstandingQueryParams) {
    const now = new Date();
    const purchases = await this.repo.findOpenPurchases(businessId, params.partyId);

    let items: OutstandingItem[] = [];

    for (const p of purchases) {
      const totalAmount = Number(p.totalAmount);
      const paid = p.payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
      const balance = Math.max(0, totalAmount - paid);

      if (balance <= 0.009) continue;

      const purDate = new Date(p.purchaseDate);
      const diffDays = Math.max(0, Math.floor((now.getTime() - purDate.getTime()) / (1000 * 3600 * 24)));
      const creditDays = this.parseCreditTerms(p.supplier?.creditTerms);
      const dueDate = new Date(purDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

      const isDueToday = this.isSameDay(now, dueDate);
      const isOverdue = now > dueDate && !isDueToday;
      const statusLabel: "OVERDUE" | "DUE TODAY" | "PENDING" = isOverdue
        ? "OVERDUE"
        : isDueToday
        ? "DUE TODAY"
        : "PENDING";
      const bucket = this.getAgeingBucket(diffDays);

      items.push({
        id: p.id,
        refNumber: p.supplierInvoiceNumber || `PUR-${p.id.slice(-6).toUpperCase()}`,
        date: p.purchaseDate,
        dueDate,
        partyId: p.supplierId,
        partyName: p.supplier?.name || "Supplier",
        partyMobile: p.supplier?.mobileNumber,
        amount: totalAmount,
        paidAmount: Number(paid.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        ageDays: diffDays,
        statusLabel,
        bucket,
      });
    }

    // Filters
    if (params.status && params.status !== "ALL") {
      items = items.filter((i) => i.statusLabel === params.status);
    }

    if (params.bucket && params.bucket !== "ALL") {
      items = items.filter((i) => i.bucket === params.bucket);
    }

    if (params.search && params.search.trim().length > 0) {
      const q = params.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.partyName.toLowerCase().includes(q) ||
          i.refNumber.toLowerCase().includes(q) ||
          (i.partyMobile && i.partyMobile.includes(q))
      );
    }

    // Sort
    const { sortBy, sortOrder } = params;
    items.sort((a: any, b: any) => {
      let vA = a[sortBy];
      let vB = b[sortBy];

      if (vA instanceof Date) vA = vA.getTime();
      if (vB instanceof Date) vB = vB.getTime();

      if (typeof vA === "string") {
        return sortOrder === "asc" ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortOrder === "asc" ? vA - vB : vB - vA;
    });

    const total = items.length;
    const skip = (params.page - 1) * params.limit;
    const paginatedItems = items.slice(skip, skip + params.limit);

    return {
      items: paginatedItems,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  /**
   * Get complete outstanding overview for a specific party (Customer or Supplier)
   */
  async getPartyOutstanding(businessId: string, type: "customer" | "supplier", partyId: string) {
    const itemsPromise =
      type === "customer"
        ? this.getReceivables(businessId, {
            status: "ALL",
            bucket: "ALL",
            partyId,
            page: 1,
            limit: 100,
            sortBy: "dueDate",
            sortOrder: "asc",
          })
        : this.getPayables(businessId, {
            status: "ALL",
            bucket: "ALL",
            partyId,
            page: 1,
            limit: 100,
            sortBy: "dueDate",
            sortOrder: "asc",
          });

    const [itemsResult, ledgerEntries] = await Promise.all([
      itemsPromise,
      this.repo.getPartyLedgerEntries(businessId, type, partyId),
    ]);

    const totalBalance = itemsResult.items.reduce((sum, item) => sum + item.balance, 0);

    return {
      partyId,
      type,
      totalOutstanding: Number(totalBalance.toFixed(2)),
      openDocumentsCount: itemsResult.items.length,
      openDocuments: itemsResult.items,
      recentLedgerEntries: ledgerEntries,
    };
  }
}

export const outstandingService = new OutstandingService();
