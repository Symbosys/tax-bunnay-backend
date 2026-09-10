import { SalesReturnStatus } from "../../../../generated/prisma/enums";
import {
  salesReturnRepository,
  SalesReturnRepository,
} from "../repo/sales-return.repo";
import type { ThermalCreditNoteReceipt } from "../types/sales-return.types";
import type {
  CreateSalesReturnInput,
  SalesReturnQueryParams,
  UpdateSalesReturnInput,
} from "../validators/sales-return.validators";

export class SalesReturnService {
  private repo: SalesReturnRepository;

  constructor(repo: SalesReturnRepository = salesReturnRepository) {
    this.repo = repo;
  }

  /**
   * 1. Get next auto-generated Credit Note / Return sequence & formatted number
   */
  async getNextNumber(businessId: string) {
    return this.repo.getNextReturnNumber(businessId);
  }

  /**
   * 2. Aggregate summary metrics for Sales Returns dashboard / top cards
   */
  async getMetrics(businessId: string) {
    return this.repo.getMetrics(businessId);
  }

  /**
   * 3. Create a Sales Return & generate Credit Note
   */
  async createSalesReturn(
    businessId: string,
    input: CreateSalesReturnInput,
    userId?: string,
    cashierName?: string
  ) {
    const salesReturn = await this.repo.createSalesReturn(businessId, input, userId);
    const receipt = this.formatThermalReceipt(salesReturn, cashierName);

    return {
      salesReturn,
      receipt,
    };
  }

  /**
   * 4. List / search / filter sales returns
   */
  async getSalesReturns(businessId: string, query: SalesReturnQueryParams) {
    return this.repo.findMany(businessId, query);
  }

  /**
   * 5. Get single sales return by ID + thermal credit note receipt
   */
  async getSalesReturnById(businessId: string, id: string, cashierName?: string) {
    const salesReturn = await this.repo.findById(businessId, id);
    const receipt = this.formatThermalReceipt(salesReturn, cashierName);

    return {
      ...salesReturn,
      receipt,
    };
  }

  /**
   * 6. Update draft sales return
   */
  async updateSalesReturn(
    businessId: string,
    id: string,
    input: UpdateSalesReturnInput,
    userId?: string
  ) {
    return this.repo.updateSalesReturn(businessId, id, input, userId);
  }

  /**
   * 7. Confirm sales return (Restocks inventory & creates Credit Note)
   */
  async confirmSalesReturn(businessId: string, id: string, userId?: string) {
    return this.repo.confirmSalesReturn(businessId, id, userId);
  }

  /**
   * 8. Cancel sales return (Reverses restocked inventory & restores customer balance)
   */
  async cancelSalesReturn(businessId: string, id: string, userId?: string) {
    return this.repo.cancelSalesReturn(businessId, id, userId);
  }

  /**
   * 9. Delete draft or cancelled sales return
   */
  async deleteSalesReturn(businessId: string, id: string) {
    return this.repo.deleteSalesReturn(businessId, id);
  }

  /**
   * 10. Update status transition
   */
  async updateStatus(
    businessId: string,
    id: string,
    status: SalesReturnStatus,
    userId?: string
  ) {
    if (status === SalesReturnStatus.CONFIRMED) {
      return this.confirmSalesReturn(businessId, id, userId);
    }
    if (status === SalesReturnStatus.CANCELLED) {
      return this.cancelSalesReturn(businessId, id, userId);
    }
    return this.repo.updateSalesReturn(businessId, id, { status }, userId);
  }

  /**
   * Format Thermal 80mm Credit Note Receipt matching UI
   */
  formatThermalReceipt(salesReturn: any, cashierName?: string): ThermalCreditNoteReceipt {
    const items = (salesReturn.items || []).map((it: any) => ({
      name: it.productName || "Returned Item",
      quantity: Number(it.quantity) || 1,
      unit: it.unit || "PCS",
      rate: Number(it.rate) || 0,
      gstRate: Number(it.gstRatePercent) || 0,
      amount: Number(it.lineTotal) || 0,
      reason: it.reason || salesReturn.reason || undefined,
    }));

    return {
      storeName: "TAX BUNNY - RETAIL STORE",
      storeAddress: "Main Branch Terminal, Commercial Hub",
      storeGstin: "07AAAAA0000A1Z5",
      storePhone: "+91 98765 43210",
      creditNoteNumber: salesReturn.returnNumber || "CN/26-27/0001",
      originalInvoiceNumber: salesReturn.invoice?.invoiceNumber || "N/A (Direct Return)",
      returnDate: new Date(salesReturn.returnDate || salesReturn.createdAt).toLocaleDateString("en-IN"),
      customerName: salesReturn.customerName || "Walk-in Customer",
      customerPhone: salesReturn.customerPhone || "N/A",
      cashier: cashierName || "Counter 1",
      reason: salesReturn.reason || "Defective / Damaged Goods",
      refundMode: salesReturn.refundMode || "Credit Note (Store Credit)",
      items,
      subtotal: Number(salesReturn.subtotal) || 0,
      cgst: Number(salesReturn.cgstAmount) || 0,
      sgst: Number(salesReturn.sgstAmount) || 0,
      igst: Number(salesReturn.igstAmount) || 0,
      cess: Number(salesReturn.cessAmount) || 0,
      roundOff: Number(salesReturn.roundOff) || 0,
      grandTotal: Number(salesReturn.totalAmount) || 0,
    };
  }
}

export const salesReturnService = new SalesReturnService();
