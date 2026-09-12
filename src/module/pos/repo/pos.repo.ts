import { prisma } from "../../../db/prisma";
import { ErrorResponse } from "../../../utils/response.util";
import type {
  ClosePosSessionInput,
  HoldPosCartInput,
  OpenPosSessionInput,
  PosCheckoutInput,
  PosProductQueryParams,
  QuickCustomerInput,
} from "../validators/pos.validators";

export class PosRepository {
  /**
   * Ensure every POS line item exists as an active listed product.
   */
  async assertListedProducts(businessId: string, productIds: Array<string | null | undefined>) {
    const ids = [
      ...new Set(
        productIds
          .map((id) => (id ?? "").trim())
          .filter((id) => id.length > 0)
      ),
    ];
    if (ids.length === 0) {
      throw new ErrorResponse(
        "Only products from Product Listing can be sold. Add the product in Product Listing first.",
        400
      );
    }

    const found = await prisma.product.findMany({
      where: { businessId, isActive: true, id: { in: ids } },
      select: { id: true },
    });

    if (found.length !== ids.length) {
      throw new ErrorResponse(
        "One or more products are not listed. Only products added in Product Listing can be sold.",
        400
      );
    }
  }

  /**
   * 1. Query POS Product Catalog with live warehouse stock
   */
  async findProducts(businessId: string, params: PosProductQueryParams) {
    const { q, barcode, warehouseId, category, page = 1, limit = 50 } = params;

    const where: any = {
      businessId,
      isActive: true,
    };

    if (category && category !== "All") {
      where.category = category;
    }

    if (barcode) {
      where.OR = [{ barcode }, { sku: barcode }, { itemCode: barcode }];
    } else if (q && q.trim().length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { itemCode: { contains: q, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          stockMovements: {
            where: warehouseId ? { warehouseId } : undefined,
            select: {
              quantity: true,
              warehouseId: true,
            },
          },
          warehouse: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // Compute live stock per product
    const formatted = products.map((p) => {
      const warehouseStocks: Record<string, number> = {};
      let totalStock = Number(p.openingStock || 0);

      p.stockMovements.forEach((sm) => {
        const qty = Number(sm.quantity);
        totalStock += qty;
        if (sm.warehouseId) {
          warehouseStocks[sm.warehouseId] =
            (warehouseStocks[sm.warehouseId] || 0) + qty;
        }
      });

      return {
        id: p.id,
        name: p.name,
        code: p.itemCode || p.sku || "",
        barcode: p.barcode || "",
        sku: p.sku || "",
        hsnCode: p.hsnCode || "",
        primaryUnit: p.primaryUnit,
        sellingPrice: Number(p.sellingPrice || 0),
        mrp: Number(p.mrp || p.sellingPrice || 0),
        purchasePrice: Number(p.purchasePrice || 0),
        gstRate: Number(p.gstRatePercent || 0),
        category: p.category || "General",
        brand: p.brand || "",
        imageUrl: p.imageUrl || null,
        currentStock: totalStock,
        warehouseStocks,
      };
    });

    return {
      products: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 2. High-speed barcode / SKU lookup for barcode scanners
   */
  async findByBarcodeOrSku(businessId: string, barcodeOrSku: string) {
    const trimmed = barcodeOrSku.trim();
    const product = await prisma.product.findFirst({
      where: {
        businessId,
        isActive: true,
        OR: [
          { barcode: { equals: trimmed, mode: "insensitive" } },
          { sku: { equals: trimmed, mode: "insensitive" } },
          { itemCode: { equals: trimmed, mode: "insensitive" } },
          { id: trimmed },
        ],
      },
      include: {
        stockMovements: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });

    if (!product) return null;

    let stock = Number(product.openingStock || 0);
    const warehouseStocks: Record<string, number> = {};

    product.stockMovements.forEach((sm) => {
      const qty = Number(sm.quantity);
      stock += qty;
      if (sm.warehouseId) {
        warehouseStocks[sm.warehouseId] =
          (warehouseStocks[sm.warehouseId] || 0) + qty;
      }
    });

    return {
      id: product.id,
      name: product.name,
      code: product.itemCode || product.sku || "",
      barcode: product.barcode || "",
      sku: product.sku || "",
      hsnCode: product.hsnCode || "",
      primaryUnit: product.primaryUnit,
      sellingPrice: Number(product.sellingPrice || 0),
      mrp: Number(product.mrp || product.sellingPrice || 0),
      gstRate: Number(product.gstRatePercent || 0),
      category: product.category || "General",
      imageUrl: product.imageUrl || null,
      currentStock: stock,
      warehouseStocks,
    };
  }

  /**
   * 3. List customers for POS selection
   */
  async findCustomers(businessId: string, search?: string) {
    const where: any = {
      businessId,
      isActive: true,
    };

    if (search && search.trim().length > 0) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { mobileNumber: { contains: search.trim() } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    return prisma.customer.findMany({
      where,
      take: 20,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        mobileNumber: true,
        email: true,
        state: true,
        gstin: true,
        billingAddress: true,
        shippingAddress: true,
      },
    });
  }

  /**
   * 4. Quick Customer creation from POS billing terminal
   */
  async createQuickCustomer(businessId: string, input: QuickCustomerInput) {
    return prisma.customer.create({
      data: {
        businessId,
        name: input.name,
        mobileNumber: input.mobileNumber,
        email: input.email,
        state: input.state || "Delhi",
        gstin: input.gstin,
        billingAddress: input.billingAddress,
        isRegistered: Boolean(input.gstin && input.gstin.trim().length > 0),
      },
    });
  }

  /**
   * 5. Get or automatically initialize default Walk-in Customer
   */
  async getOrCreateWalkInCustomer(businessId: string) {
    let customer = await prisma.customer.findFirst({
      where: {
        businessId,
        name: { equals: "Walk-in Customer", mode: "insensitive" },
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId,
          name: "Walk-in Customer",
          mobileNumber: "9999999999",
          state: "Delhi",
          isRegistered: false,
          billingAddress: "Retail Counter Sale",
        },
      });
    }

    return customer;
  }

  /**
   * 6. Generate sequential POS Invoice Number
   */
  async generatePosInvoiceNumber(businessId: string): Promise<string> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const datePrefix = `INV-POS-${yyyy}${mm}${dd}-`;

    const countToday = await prisma.invoice.count({
      where: {
        businessId,
        invoiceNumber: { startsWith: datePrefix },
      },
    });

    const seq = String(countToday + 1).padStart(4, "0");
    return `${datePrefix}${seq}`;
  }

  /**
   * 7. Create Complete POS Sale Transaction (Invoice + Items + StockMovement + Receipt)
   */
  async createPosSale(
    businessId: string,
    input: PosCheckoutInput,
    customerId: string,
    userId?: string
  ) {
    const invoiceNumber = await this.generatePosInvoiceNumber(businessId);
    const resolvedWarehouseId = input.warehouseId || "main";

    return prisma.$transaction(async (tx) => {
      // 1. Fetch customer and business details
      const [customer, business, defaultWarehouse] = await Promise.all([
        tx.customer.findUnique({ where: { id: customerId } }),
        tx.business.findUnique({ where: { id: businessId } }),
        tx.warehouse.findFirst({ where: { businessId, isDefault: true } }),
      ]);

      const warehouseDbId =
        resolvedWarehouseId !== "main"
          ? resolvedWarehouseId
          : defaultWarehouse?.id || (await tx.warehouse.findFirst({ where: { businessId } }))?.id;

      // 2. Compute GST components
      const isInterState =
        Boolean(customer?.state && business?.state) &&
        customer!.state!.toLowerCase() !== business!.state!.toLowerCase();

      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      let totalCess = 0;

      input.items.forEach((item) => {
        const taxable = item.taxableValue || item.rate * item.quantity;
        const rate = item.gstRate || 0;

        if (isInterState) {
          totalIgst += taxable * (rate / 100);
        } else {
          totalCgst += taxable * (rate / 200);
          totalSgst += taxable * (rate / 200);
        }
        totalCess += item.cess || 0;
      });

      // 3. Map payment mode enum
      let paymentModeEnum: any = "CASH";
      const pMode = input.paymentMode?.toUpperCase();
      if (pMode === "UPI") paymentModeEnum = "UPI";
      else if (pMode === "CARD") paymentModeEnum = "CARD";
      else if (pMode === "CREDIT") paymentModeEnum = "CREDIT";
      else if (pMode === "CASH") paymentModeEnum = "CASH";
      else paymentModeEnum = "OTHER";

      const paymentStatusEnum: any =
        input.paymentMode === "Credit" ? "UNPAID" : "PAID";

      // 4. Create Invoice record
      const invoice = await tx.invoice.create({
        data: {
          businessId,
          invoiceNumber,
          invoiceDate: new Date(),
          customerId,
          billingAddress: customer?.billingAddress || "Retail Counter",
          shippingAddress: customer?.shippingAddress || "Retail Counter",
          placeOfSupply: customer?.state || business?.state || "Delhi",
          supplyType: customer?.isRegistered ? "B2B" : "B2C",
          taxableValue: input.subtotal,
          cgstAmount: Number(totalCgst.toFixed(2)),
          sgstAmount: Number(totalSgst.toFixed(2)),
          igstAmount: Number(totalIgst.toFixed(2)),
          cessAmount: Number(totalCess.toFixed(2)),
          roundOff: input.roundOff,
          grandTotal: input.grandTotal,
          paymentMode: paymentModeEnum,
          paymentStatus: paymentStatusEnum,
          status: "SAVED",
          notes: input.notes || "POS Fast Billing Sale",
          termsAndConditions: input.termsConditions || "Goods once sold are not returnable.",
          createdByUserId: userId,
        },
      });

      // 5. Create Sale Record in `sales` and `sale_items` tables
      const saleNumber = invoiceNumber.replace("INV-POS-", "SALE-POS-");
      const sale = await tx.sale.create({
        data: {
          businessId,
          saleNumber,
          saleDate: new Date(),
          customerId,
          customerName: customer?.name || input.customerName || "Walk-in Customer",
          customerPhone: customer?.mobileNumber || "",
          billingAddress: customer?.billingAddress || "Retail Counter",
          shippingAddress: customer?.shippingAddress || "Retail Counter",
          placeOfSupply: customer?.state || business?.state || "Delhi",
          warehouseId: warehouseDbId,
          subtotal: input.subtotal,
          discountPercent: input.cartDiscountPercent,
          discountAmount: input.cartDiscountAmount,
          taxableValue: input.subtotal - input.cartDiscountAmount,
          cgstAmount: Number(totalCgst.toFixed(2)),
          sgstAmount: Number(totalSgst.toFixed(2)),
          igstAmount: Number(totalIgst.toFixed(2)),
          cessAmount: Number(totalCess.toFixed(2)),
          roundOff: input.roundOff,
          grandTotal: input.grandTotal,
          paidAmount: paymentStatusEnum === "PAID" ? input.grandTotal : 0,
          balanceAmount: paymentStatusEnum === "PAID" ? 0 : input.grandTotal,
          changeReturned: input.changeDue || 0,
          paymentMode: paymentModeEnum,
          paymentStatus: paymentStatusEnum,
          status: "COMPLETED",
          notes: input.notes || "POS Fast Billing Sale",
          termsAndConditions: input.termsConditions || "Goods once sold are not returnable.",
          invoiceId: invoice.id,
          createdByUserId: userId,
          items: {
            create: input.items.map((item) => {
              const taxable = item.taxableValue || item.rate * item.quantity;
              const rate = item.gstRate || 0;
              const cgst = isInterState ? 0 : Number((taxable * (rate / 200)).toFixed(2));
              const sgst = isInterState ? 0 : Number((taxable * (rate / 200)).toFixed(2));
              const igst = isInterState ? Number((taxable * (rate / 100)).toFixed(2)) : 0;
              const lineTotal = taxable + cgst + sgst + igst + (item.cess || 0);

              return {
                productId: item.productId,
                productName: item.name,
                hsnOrSacCode: item.hsnSac,
                quantity: item.quantity,
                unit: item.unit || "PCS",
                rate: item.rate,
                discountPercent: item.discountPercentage || 0,
                discountAmount: item.discountAmount || 0,
                taxableValue: taxable,
                gstRatePercent: rate,
                cgstAmount: cgst,
                sgstAmount: sgst,
                igstAmount: igst,
                cessAmount: item.cess || 0,
                lineTotal: lineTotal,
              };
            }),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // 6. Create Invoice Line Items
      for (const item of input.items) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            productId: item.productId,
            hsnOrSacCode: item.hsnSac,
            quantity: item.quantity,
            unit: item.unit || "PCS",
            rate: item.rate,
            discountPercent: item.discountPercentage || 0,
            taxableValue: item.taxableValue || item.rate * item.quantity,
            gstRatePercent: item.gstRate || 0,
            cgstAmount: isInterState ? 0 : Number(((item.taxableValue * (item.gstRate / 200))).toFixed(2)),
            sgstAmount: isInterState ? 0 : Number(((item.taxableValue * (item.gstRate / 200))).toFixed(2)),
            igstAmount: isInterState ? Number(((item.taxableValue * (item.gstRate / 100))).toFixed(2)) : 0,
            cessAmount: item.cess || 0,
            lineTotal:
              (item.taxableValue || item.rate * item.quantity) +
              (item.taxableValue * (item.gstRate / 100)),
          },
        });

        // 7. Record Stock Deduction (Negative quantity for StockMovement)
        if (warehouseDbId && item.productId) {
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              warehouseId: warehouseDbId,
              movementType: "SALES",
              quantity: -Math.abs(item.quantity),
              unitCost: item.rate,
              referenceType: "SALE",
              referenceId: sale.id,
            },
          });
        }
      }

      // 8. If paid, create Receipt record
      if (paymentStatusEnum === "PAID") {
        const receipt = await tx.receipt.create({
          data: {
            businessId,
            referenceNumber: `REC-POS-${invoice.invoiceNumber}`,
            customerId,
            receiptDate: new Date(),
            amount: input.grandTotal,
            paymentMode: paymentModeEnum,
            notes: `POS Cashier Settlement for ${invoice.invoiceNumber}`,
          },
        });

        await tx.receiptAllocation.create({
          data: {
            receiptId: receipt.id,
            invoiceId: invoice.id,
            allocatedAmount: input.grandTotal,
          },
        });
      }

      // 9. Record Ledger Entry
      await tx.ledgerEntry.create({
        data: {
          businessId,
          customerId,
          entryType: "DEBIT",
          debitAmount: input.grandTotal,
          creditAmount: 0,
          particulars: `POS Bill #${invoice.invoiceNumber} - ${input.paymentMode} sale`,
          invoiceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
        },
      });

      if (paymentStatusEnum === "PAID") {
        await tx.ledgerEntry.create({
          data: {
            businessId,
            customerId,
            entryType: "CREDIT",
            debitAmount: 0,
            creditAmount: input.grandTotal,
            particulars: `POS Payment Settlement for #${invoice.invoiceNumber}`,
            invoiceId: invoice.id,
            referenceNumber: invoice.invoiceNumber,
          },
        });
      }

      return { invoice, sale };
    });
  }

  /**
   * 8. Fetch complete POS Invoice for Receipt Printing
   */
  async getInvoiceWithDetails(businessId: string, invoiceId: string) {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        businessId,
      },
      include: {
        customer: true,
        business: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * 9. Manage Parked / Held POS Carts via AuditLog
   */
  async saveHeldCart(businessId: string, input: HoldPosCartInput, userId?: string) {
    const cartId = `held_cart_${Date.now()}`;
    return prisma.auditLog.create({
      data: {
        businessId,
        userId,
        entityType: "POS_HELD_CART",
        entityId: cartId,
        action: "CREATE",
        updatedData: {
          cartId,
          heldAt: new Date().toISOString(),
          ...input,
        },
      },
    });
  }

  async getHeldCarts(businessId: string) {
    const records = await prisma.auditLog.findMany({
      where: {
        businessId,
        entityType: "POS_HELD_CART",
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return records.map((r) => r.updatedData);
  }

  async removeHeldCart(businessId: string, cartId: string) {
    return prisma.auditLog.deleteMany({
      where: {
        businessId,
        entityType: "POS_HELD_CART",
        entityId: cartId,
      },
    });
  }

  /**
   * 10. Register Cash Sessions (Open, Active, Close, History)
   */
  async openRegisterSession(
    businessId: string,
    input: OpenPosSessionInput,
    userId?: string,
    cashierName?: string
  ) {
    const sessionId = `pos_session_${Date.now()}`;
    return prisma.auditLog.create({
      data: {
        businessId,
        userId,
        entityType: "POS_SESSION",
        entityId: sessionId,
        action: "OPEN",
        updatedData: {
          sessionId,
          status: "OPEN",
          openedAt: new Date().toISOString(),
          openingCash: input.openingCash,
          warehouseId: input.warehouseId,
          posMachineId: input.posMachineId || "POS-TERMINAL-01",
          cashierId: userId || "SYSTEM",
          cashierName: cashierName || "Cashier",
          notes: input.notes,
        },
      },
    });
  }

  async getActiveRegisterSession(businessId: string, userId?: string) {
    const where: any = {
      businessId,
      entityType: "POS_SESSION",
      action: "OPEN",
    };
    if (userId) {
      where.userId = userId;
    }

    const sessionRecord = await prisma.auditLog.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (!sessionRecord) return null;

    const data: any = sessionRecord.updatedData;

    // Calculate current session sales from openedAt timestamp
    const openedAt = new Date(data.openedAt);
    const sessionInvoices = await prisma.invoice.findMany({
      where: {
        businessId,
        invoiceDate: { gte: openedAt },
        invoiceNumber: { startsWith: "INV-POS-" },
      },
      select: {
        grandTotal: true,
        paymentMode: true,
      },
    });

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let creditSales = 0;

    sessionInvoices.forEach((inv) => {
      const amt = Number(inv.grandTotal);
      totalSales += amt;
      const mode = String(inv.paymentMode).toUpperCase();
      if (mode === "CASH") cashSales += amt;
      else if (mode === "CARD") cardSales += amt;
      else if (mode === "UPI") upiSales += amt;
      else if (mode === "CREDIT") creditSales += amt;
    });

    return {
      ...data,
      totalSales,
      cashSales,
      cardSales,
      upiSales,
      creditSales,
      invoiceCount: sessionInvoices.length,
      expectedCash: (data.openingCash || 0) + cashSales,
    };
  }

  async closeRegisterSession(
    businessId: string,
    sessionId: string,
    input: ClosePosSessionInput,
    userId?: string
  ) {
    const activeSessionRecord = await prisma.auditLog.findFirst({
      where: {
        businessId,
        entityType: "POS_SESSION",
        entityId: sessionId,
        action: "OPEN",
      },
    });

    if (!activeSessionRecord) return null;

    const sessionData: any = activeSessionRecord.updatedData;
    const openedAt = new Date(sessionData.openedAt);

    // Compute final sales metrics
    const sessionInvoices = await prisma.invoice.findMany({
      where: {
        businessId,
        invoiceDate: { gte: openedAt },
        invoiceNumber: { startsWith: "INV-POS-" },
      },
      select: {
        grandTotal: true,
        paymentMode: true,
      },
    });

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let creditSales = 0;

    sessionInvoices.forEach((inv) => {
      const amt = Number(inv.grandTotal);
      totalSales += amt;
      const mode = String(inv.paymentMode).toUpperCase();
      if (mode === "CASH") cashSales += amt;
      else if (mode === "CARD") cardSales += amt;
      else if (mode === "UPI") upiSales += amt;
      else if (mode === "CREDIT") creditSales += amt;
    });

    const expectedCash = (sessionData.openingCash || 0) + cashSales;
    const actualClosingCash = input.actualClosingCash;
    const discrepancy = actualClosingCash - expectedCash;

    // Update session record to CLOSED
    await prisma.auditLog.update({
      where: { id: activeSessionRecord.id },
      data: {
        action: "CLOSED",
        updatedData: {
          ...sessionData,
          status: "CLOSED",
          closedAt: new Date().toISOString(),
          actualClosingCash,
          expectedClosingCash: expectedCash,
          cashDiscrepancy: discrepancy,
          totalSales,
          cashSales,
          cardSales,
          upiSales,
          creditSales,
          totalTransactions: sessionInvoices.length,
          closingNotes: input.closingNotes,
        },
      },
    });

    return {
      sessionId,
      status: "CLOSED",
      openingCash: sessionData.openingCash,
      actualClosingCash,
      expectedCash,
      discrepancy,
      totalSales,
      totalTransactions: sessionInvoices.length,
    };
  }

  async getSessionHistory(businessId: string) {
    const sessions = await prisma.auditLog.findMany({
      where: {
        businessId,
        entityType: "POS_SESSION",
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return sessions.map((s) => s.updatedData);
  }

  /**
   * 11. Daily Dashboard & Metrics Summary for POS
   */
  async getDailySummary(businessId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const invoices = await prisma.invoice.findMany({
      where: {
        businessId,
        invoiceDate: { gte: startOfDay },
        invoiceNumber: { startsWith: "INV-POS-" },
      },
      select: {
        grandTotal: true,
        paymentMode: true,
      },
    });

    let totalRevenue = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;
    let creditRevenue = 0;

    invoices.forEach((inv) => {
      const val = Number(inv.grandTotal);
      totalRevenue += val;
      const mode = String(inv.paymentMode).toUpperCase();
      if (mode === "CASH") cashRevenue += val;
      else if (mode === "UPI") upiRevenue += val;
      else if (mode === "CARD") cardRevenue += val;
      else if (mode === "CREDIT") creditRevenue += val;
    });

    const activeHeldCarts = await prisma.auditLog.count({
      where: {
        businessId,
        entityType: "POS_HELD_CART",
        action: "CREATE",
      },
    });

    return {
      todayRevenue: totalRevenue,
      billsCount: invoices.length,
      avgTicketSize: invoices.length > 0 ? totalRevenue / invoices.length : 0,
      cashRevenue,
      upiRevenue,
      cardRevenue,
      creditRevenue,
      activeHeldCarts,
    };
  }

  /**
   * 12. Query Recorded Sales from `sales` table
   */
  async findSales(
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
    const { q, customerId, paymentMode, status, page = 1, limit = 50 } = params;
    const where: any = { businessId };

    if (customerId) where.customerId = customerId;
    if (paymentMode) where.paymentMode = paymentMode as any;
    if (status) where.status = status;
    if (q && q.trim().length > 0) {
      where.OR = [
        { saleNumber: { contains: q.trim(), mode: "insensitive" } },
        { customerName: { contains: q.trim(), mode: "insensitive" } },
        { customerPhone: { contains: q.trim() } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  barcode: true,
                  sku: true,
                  primaryUnit: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 13. Get Sale by ID from `sales` table
   */
  async findSaleById(businessId: string, saleId: string) {
    return prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        invoice: true,
      },
    });
  }
}

export const posRepository = new PosRepository();
