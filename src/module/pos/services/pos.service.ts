import { ErrorResponse } from "../../../utils/response.util";
import { posRepository, PosRepository } from "../repo/pos.repo";
import type {
  ClosePosSessionInput,
  HoldPosCartInput,
  OpenPosSessionInput,
  PosCheckoutInput,
  PosProductQueryParams,
  QuickCustomerInput,
} from "../validators/pos.validators";

export class PosService {
  private repo: PosRepository;

  constructor(repo: PosRepository = posRepository) {
    this.repo = repo;
  }

  /**
   * 1. Query POS Product Catalog with Stock Availability
   */
  async getProducts(businessId: string, params: PosProductQueryParams) {
    return this.repo.findProducts(businessId, params);
  }

  /**
   * 2. Barcode scanner instant lookup
   */
  async scanBarcode(businessId: string, barcode: string) {
    if (!barcode || barcode.trim().length === 0) {
      throw new ErrorResponse("Barcode is required", 400);
    }
    const clean = barcode.trim();
    const product = await this.repo.findByBarcodeOrSku(businessId, clean);
    if (!product) {
      throw new ErrorResponse(
        `Barcode "${clean}" is not in Product Listing. This product cannot be sold until it is listed.`,
        404
      );
    }
    return product;
  }

  /**
   * 3. Get customer list for POS dropdown
   */
  async getCustomers(businessId: string, search?: string) {
    return this.repo.findCustomers(businessId, search);
  }

  /**
   * 4. Quick customer creation from POS terminal
   */
  async quickCreateCustomer(businessId: string, input: QuickCustomerInput) {
    return this.repo.createQuickCustomer(businessId, input);
  }

  /**
   * 5. Open POS Register Session
   */
  async openSession(
    businessId: string,
    input: OpenPosSessionInput,
    userId?: string,
    cashierName?: string
  ) {
    const existing = await this.repo.getActiveRegisterSession(businessId, userId);
    if (existing) {
      return {
        message: "An active POS register session is already open",
        session: existing,
      };
    }

    const session = await this.repo.openRegisterSession(
      businessId,
      input,
      userId,
      cashierName
    );

    return {
      message: "POS register session opened successfully",
      session: session.updatedData,
    };
  }

  /**
   * 6. Get currently active POS session
   */
  async getActiveSession(businessId: string, userId?: string) {
    return this.repo.getActiveRegisterSession(businessId, userId);
  }

  /**
   * 7. Close POS Register Session and calculate cash drawer reconciliation
   */
  async closeSession(
    businessId: string,
    input: ClosePosSessionInput,
    userId?: string
  ) {
    const active = await this.repo.getActiveRegisterSession(businessId, userId);
    if (!active) {
      throw new ErrorResponse("No active POS register session found to close", 404);
    }

    const closed = await this.repo.closeRegisterSession(
      businessId,
      active.sessionId,
      input,
      userId
    );

    return {
      message: "POS session closed and register consolidated successfully",
      summary: closed,
    };
  }

  /**
   * 8. Get session history
   */
  async getSessionHistory(businessId: string) {
    return this.repo.getSessionHistory(businessId);
  }

  /**
   * 9. Process POS Checkout & Generate Invoice + Thermal Receipt
   */
  async processCheckout(
    businessId: string,
    input: PosCheckoutInput,
    userId?: string,
    cashierName?: string
  ) {
    if (!input.items || input.items.length === 0) {
      throw new ErrorResponse("POS Cart is empty. Please add items before checkout.", 400);
    }

    await this.repo.assertListedProducts(
      businessId,
      input.items.map((item) => item.productId)
    );

    // Resolve Customer: If no customerId, fetch or create default Walk-in Customer
    let customerId = input.customerId;
    if (!customerId || customerId.trim().length === 0) {
      const walkIn = await this.repo.getOrCreateWalkInCustomer(businessId);
      customerId = walkIn.id;
    }

    // Record invoice, sale & update inventory
    const { invoice, sale } = await this.repo.createPosSale(
      businessId,
      input,
      customerId,
      userId
    );

    // Fetch full details for receipt rendering
    const fullInvoice = await this.repo.getInvoiceWithDetails(businessId, invoice.id);
    const receiptData = this.formatThermalReceipt(fullInvoice, cashierName);

    return {
      sale,
      invoice,
      receipt: receiptData,
    };
  }

  /**
   * 10. Park / Hold Cart
   */
  async holdCart(businessId: string, input: HoldPosCartInput, userId?: string) {
    if (!input.items || input.items.length === 0) {
      throw new ErrorResponse("Cannot hold an empty cart", 400);
    }
    const held = await this.repo.saveHeldCart(businessId, input, userId);
    return {
      message: "POS Cart parked / held successfully",
      heldCart: held.updatedData,
    };
  }

  /**
   * 11. Get list of parked / held carts
   */
  async getHeldCarts(businessId: string) {
    return this.repo.getHeldCarts(businessId);
  }

  /**
   * 12. Resume held cart
   */
  async resumeHeldCart(businessId: string, cartId: string) {
    const carts = await this.repo.getHeldCarts(businessId);
    const cart = carts.find((c: any) => c.cartId === cartId);
    if (!cart) {
      throw new ErrorResponse("Held cart not found or already processed", 404);
    }
    // Remove from held state upon resumption
    await this.repo.removeHeldCart(businessId, cartId);
    return {
      message: "Held cart resumed successfully",
      cart,
    };
  }

  /**
   * 13. Delete / discard held cart
   */
  async deleteHeldCart(businessId: string, cartId: string) {
    await this.repo.removeHeldCart(businessId, cartId);
    return {
      message: "Held cart removed successfully",
    };
  }

  /**
   * 14. Get formatted thermal receipt for an existing invoice
   */
  async getReceipt(businessId: string, invoiceId: string, cashierName?: string) {
    const invoice = await this.repo.getInvoiceWithDetails(businessId, invoiceId);
    if (!invoice) {
      throw new ErrorResponse("Invoice not found", 404);
    }
    return this.formatThermalReceipt(invoice, cashierName);
  }

  /**
   * 15. Format 80mm Thermal Receipt Data Payload
   */
  private formatThermalReceipt(invoice: any, cashierName?: string) {
    const b = invoice.business || {};
    const c = invoice.customer || {};

    const items = (invoice.items || []).map((item: any) => ({
      name: item.product?.name || item.hsnOrSacCode || "Item",
      quantity: Number(item.quantity),
      unit: item.unit || "PCS",
      rate: Number(item.rate),
      discount: Number(item.discountPercent || 0),
      total: Number(item.totalAmount || item.taxableValue),
      taxable: Number(item.taxableValue),
      cgst: Number(item.cgstAmount || 0),
      sgst: Number(item.sgstAmount || 0),
      igst: Number(item.igstAmount || 0),
    }));

    return {
      header: {
        storeName: b.tradeName || b.businessName || "TAX BUNNY RETAIL STORE",
        legalName: b.legalName || b.businessName,
        address: b.businessAddress || b.billingAddress || "Retail Counter",
        gstin: b.gstin || "URP (Unregistered)",
        mobileNumber: b.mobileNumber || "",
        email: b.email || "",
      },
      meta: {
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.invoiceDate,
        cashier: cashierName || "Cashier",
        terminal: "POS-01",
      },
      customer: {
        name: c.name || "Walk-in Customer",
        mobileNumber: c.mobileNumber || "",
        gstin: c.gstin || "",
      },
      items,
      totals: {
        subtotal: Number(invoice.taxableValue || 0),
        cgst: Number(invoice.cgstAmount || 0),
        sgst: Number(invoice.sgstAmount || 0),
        igst: Number(invoice.igstAmount || 0),
        totalTax:
          Number(invoice.cgstAmount || 0) +
          Number(invoice.sgstAmount || 0) +
          Number(invoice.igstAmount || 0),
        roundOff: Number(invoice.roundOff || 0),
        grandTotal: Number(invoice.grandTotal || 0),
        paymentMode: invoice.paymentMode || "CASH",
        paymentStatus: invoice.paymentStatus || "PAID",
      },
      footer: {
        notes: invoice.notes || "Thank you for shopping with us!",
        terms: invoice.termsAndConditions || "Goods once sold are not returnable.",
      },
    };
  }

  /**
   * 16. POS Dashboard summary
   */
  async getDashboardSummary(businessId: string) {
    return this.repo.getDailySummary(businessId);
  }

  /**
   * 17. Query Recorded Sales from `sales` table
   */
  async getSales(
    businessId: string,
    params: {
      q?: string;
      customerId?: string;
      paymentMode?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    return this.repo.findSales(businessId, params);
  }

  /**
   * 18. Get Sale by ID
   */
  async getSaleById(businessId: string, saleId: string) {
    const sale = await this.repo.findSaleById(businessId, saleId);
    if (!sale) {
      throw new ErrorResponse("Sale record not found", 404);
    }
    return sale;
  }
}

export const posService = new PosService();
