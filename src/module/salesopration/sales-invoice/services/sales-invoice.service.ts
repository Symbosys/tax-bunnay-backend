import { InvoiceStatus } from "../../../../generated/prisma/enums";
import { salesInvoiceRepository, SalesInvoiceRepository } from "../repo/sales-invoice.repo";
import type {
  CreateSalesInvoiceInput,
  HoldSalesInvoiceInput,
  SalesInvoiceQueryParams,
  UpdateSalesInvoiceInput,
} from "../validators/sales-invoice.validators";

export class SalesInvoiceService {
  private repo: SalesInvoiceRepository;

  constructor(repo: SalesInvoiceRepository = salesInvoiceRepository) {
    this.repo = repo;
  }

  /**
   * 1. Get next auto-generated sales invoice sequence & formatted number
   */
  async getNextNumber(businessId: string) {
    return this.repo.getNextInvoiceNumber(businessId);
  }

  /**
   * 2. Create Sales Invoice & return invoice + thermal receipt payload
   */
  async createInvoice(
    businessId: string,
    input: CreateSalesInvoiceInput,
    userId?: string,
    cashierName?: string
  ) {
    const invoice = await this.repo.createSalesInvoice(businessId, input, userId);
    const receipt = this.formatThermalReceipt(invoice, cashierName);

    return {
      invoice,
      receipt,
    };
  }

  /**
   * 3. Fetch list of invoices with filters
   */
  async getInvoices(businessId: string, query: SalesInvoiceQueryParams) {
    return this.repo.findMany(businessId, query);
  }

  /**
   * 4. Fetch invoice by ID + thermal receipt
   */
  async getInvoiceById(businessId: string, id: string, cashierName?: string) {
    const invoice = await this.repo.findById(businessId, id);
    const receipt = this.formatThermalReceipt(invoice, cashierName);

    return {
      ...invoice,
      receipt,
    };
  }

  /**
   * 5. Update invoice
   */
  async updateInvoice(
    businessId: string,
    id: string,
    input: UpdateSalesInvoiceInput,
    userId?: string
  ) {
    return this.repo.updateSalesInvoice(businessId, id, input, userId);
  }

  /**
   * 6. Quick status update (e.g. SAVED -> PRINTED)
   */
  async updateStatus(businessId: string, id: string, status: InvoiceStatus) {
    return this.repo.updateStatus(businessId, id, status);
  }

  /**
   * 7. Cancel sales invoice & revert inventory
   */
  async cancelInvoice(businessId: string, id: string) {
    return this.repo.cancelSalesInvoice(businessId, id);
  }

  /**
   * 8. Delete draft or cancelled invoice
   */
  async deleteInvoice(businessId: string, id: string) {
    return this.repo.deleteSalesInvoice(businessId, id);
  }

  /**
   * 9. Daily sales & POS terminal summary metrics
   */
  async getMetrics(businessId: string) {
    return this.repo.getSalesMetrics(businessId);
  }

  /**
   * 10. Fast hold / park bill
   */
  async holdInvoice(businessId: string, input: HoldSalesInvoiceInput, userId?: string) {
    return this.repo.holdCart(businessId, input, userId);
  }

  /**
   * 11. List currently parked / held bills
   */
  async getHeldInvoices(businessId: string) {
    return this.repo.getHeldInvoices(businessId);
  }

  /**
   * 12. Resume a held bill
   */
  async resumeHeldInvoice(businessId: string, id: string) {
    return this.repo.resumeHeldInvoice(businessId, id);
  }

  /**
   * Formats thermal 80mm receipt payload matching SalesBillSuccessDialog UI
   */
  formatThermalReceipt(invoice: any, cashierName?: string) {
    const business = invoice.business || {};
    const storeName = business.tradeName || business.legalName || "TAX BUNNY RETAIL STORE";
    const storeAddress = business.businessAddress || business.address || "Main Market, Sector 18, Commercial Hub";
    const storeGstin = business.gstin || "07AAAAA0000A1Z5";
    const storePhone = business.mobileNumber || business.phone || "+91 98765 43210";

    const customerName = invoice.customer?.name || invoice.customerName || "Walk-in Customer";
    const customerPhone = invoice.customer?.mobileNumber || invoice.customerPhone || "N/A";

    const items = (invoice.items || []).map((item: any) => {
      const name = item.productName || item.product?.name || "Item";
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.rate) || 0;
      const amount = Number(item.lineTotal) || qty * rate;

      return {
        name,
        qty,
        unit: item.unit || "PCS",
        rate: rate.toFixed(2),
        amount: amount.toFixed(2),
      };
    });

    const subtotal = Number(invoice.subtotal || invoice.taxableValue || 0);
    const discount = Number(invoice.discountAmount || 0);
    const cgst = Number(invoice.cgstAmount || 0);
    const sgst = Number(invoice.sgstAmount || 0);
    const igst = Number(invoice.igstAmount || 0);
    const grandTotal = Number(invoice.grandTotal || 0);
    const paidAmount = Number(invoice.paidAmount || grandTotal);
    const changeReturned = Number(invoice.changeReturned || 0);

    const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
    const formattedDate = invoiceDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const formattedTime = invoiceDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return {
      store: {
        name: storeName,
        address: storeAddress,
        gstin: storeGstin,
        phone: storePhone,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: formattedDate,
        time: formattedTime,
        cashier: cashierName || "Counter 1",
      },
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      items,
      totals: {
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        igst: igst.toFixed(2),
        totalGst: (cgst + sgst + igst).toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        changeReturned: changeReturned.toFixed(2),
        paymentMode: invoice.paymentMode || "CASH",
        paymentStatus: invoice.paymentStatus || "PAID",
      },
      footerNote: "Thank you for shopping with us! Visit again.",
    };
  }
}

export const salesInvoiceService = new SalesInvoiceService();
