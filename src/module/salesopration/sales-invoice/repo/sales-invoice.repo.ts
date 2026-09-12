import { prisma } from "../../../../db/prisma";
import {
  GstSupplyType,
  InvoiceStatus,
  LedgerEntryType,
  PaymentMode,
  PaymentStatus,
  StockMovementType,
} from "../../../../generated/prisma/enums";
import { ErrorResponse } from "../../../../utils/response.util";
import type {
  CreateSalesInvoiceInput,
  HoldSalesInvoiceInput,
  SalesInvoiceItemInput,
  SalesInvoiceQueryParams,
  UpdateSalesInvoiceInput,
} from "../validators/sales-invoice.validators";

const invoiceInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      gstin: true,
      state: true,
      mobileNumber: true,
      email: true,
      billingAddress: true,
      shippingAddress: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          itemCode: true,
          sku: true,
          barcode: true,
          hsnCode: true,
          primaryUnit: true,
          gstRatePercent: true,
          sellingPrice: true,
          mrp: true,
          category: true,
          subCategory: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          sacCode: true,
          rate: true,
        },
      },
    },
    orderBy: { id: "asc" as const },
  },
  series: true,
};

export class SalesInvoiceRepository {
  /**
   * Helper: Get or seed default invoice numbering series
   */
  async ensureDefaultSeries(businessId: string) {
    const existing = await prisma.invoiceSeries.findFirst({
      where: { businessId, isDefault: true },
    });
    if (existing) return existing;

    const anySeries = await prisma.invoiceSeries.findFirst({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });
    if (anySeries) return anySeries;

    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    const fyTag = `${currentYear.toString().slice(-2)}-${nextYear}`;

    return prisma.invoiceSeries.create({
      data: {
        businessId,
        seriesName: "Default",
        prefix: "TB",
        financialYearTag: fyTag,
        startingNumber: 1,
        currentNumber: 0,
        isDefault: true,
      },
    });
  }

  /**
   * Generates the next sequential invoice number without saving
   */
  async getNextInvoiceNumber(businessId: string) {
    const series = await this.ensureDefaultSeries(businessId);
    const nextSequence = series.currentNumber + 1;
    const fy = series.financialYearTag ? `/${series.financialYearTag}` : "";
    const formatted = `${series.prefix}${fy}/${String(nextSequence).padStart(4, "0")}`;

    return {
      seriesId: series.id,
      seriesName: series.seriesName,
      prefix: series.prefix,
      financialYearTag: series.financialYearTag,
      nextSequence,
      invoiceNumber: formatted,
    };
  }

  /**
   * Helper: Resolve active warehouse for inventory deduction
   */
  async resolveWarehouseId(businessId: string, warehouseId?: string | null) {
    if (warehouseId && warehouseId !== "main") {
      const match = await prisma.warehouse.findFirst({
        where: { id: warehouseId, businessId, isActive: true },
        select: { id: true },
      });
      if (match) return match.id;
    }

    const defaultWh = await prisma.warehouse.findFirst({
      where: { businessId, isDefault: true, isActive: true },
      select: { id: true },
    });
    if (defaultWh) return defaultWh.id;

    const anyWh = await prisma.warehouse.findFirst({
      where: { businessId, isActive: true },
      select: { id: true },
    });
    return anyWh?.id ?? null;
  }

  /**
   * Helper: Get or create default Walk-in Customer for retail POS
   */
  async getOrCreateWalkInCustomer(businessId: string, name = "Walk-in Customer", phone?: string | null) {
    const existing = await prisma.customer.findFirst({
      where: {
        businessId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) return existing;

    return prisma.customer.create({
      data: {
        businessId,
        name,
        mobileNumber: phone || null,
        isRegistered: false,
        customerGroup: "Retail",
        state: "Delhi",
        stateCode: "07",
      },
    });
  }

  /**
   * Create a Sales Invoice with full transaction integrity
   */
  async createSalesInvoice(
    businessId: string,
    input: CreateSalesInvoiceInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve numbering series & invoice number
      let seriesId = input.seriesId;
      let invoiceNumber = input.invoiceNumber?.trim();

      if (!invoiceNumber) {
        let series = seriesId
          ? await tx.invoiceSeries.findFirst({ where: { id: seriesId, businessId } })
          : null;

        if (!series) {
          series = await tx.invoiceSeries.findFirst({
            where: { businessId, isDefault: true },
          });
        }

        if (!series) {
          const currentYear = new Date().getFullYear();
          const nextYear = (currentYear + 1).toString().slice(-2);
          const fyTag = `${currentYear.toString().slice(-2)}-${nextYear}`;

          series = await tx.invoiceSeries.create({
            data: {
              businessId,
              seriesName: "Default",
              prefix: "TB",
              financialYearTag: fyTag,
              startingNumber: 1,
              currentNumber: 0,
              isDefault: true,
            },
          });
        }

        const nextNum = series.currentNumber + 1;
        const fy = series.financialYearTag ? `/${series.financialYearTag}` : "";
        invoiceNumber = `${series.prefix}${fy}/${String(nextNum).padStart(4, "0")}`;
        seriesId = series.id;

        // Atomically increment currentNumber
        await tx.invoiceSeries.update({
          where: { id: series.id },
          data: { currentNumber: nextNum },
        });
      }

      // Check unique invoice number for this business
      const duplicate = await tx.invoice.findFirst({
        where: { businessId, invoiceNumber },
      });
      if (duplicate) {
        invoiceNumber = `${invoiceNumber}-${Date.now().toString().slice(-4)}`;
      }

      // 2. Resolve Customer (support Walk-in Customer)
      let customerId = input.customerId;
      let customerName = input.customerName || "Walk-in Customer";
      let customerPhone = input.customerPhone;

      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, businessId },
        });
        if (customer) {
          customerName = customer.name;
          customerPhone = customerPhone || customer.mobileNumber;
        } else {
          customerId = null;
        }
      }

      const productIds = [
        ...new Set(
          (input.items || [])
            .map((item) => (item.productId || "").trim())
            .filter((id) => id.length > 0)
        ),
      ];
      if (productIds.length > 0) {
        const listed = await tx.product.findMany({
          where: { businessId, isActive: true, id: { in: productIds } },
          select: { id: true },
        });
        if (listed.length !== productIds.length) {
          throw new ErrorResponse(
            "One or more products are not listed. Only products added in Product Listing can be sold.",
            400
          );
        }
      }

      // 3. Compute Item Lines and Totals
      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      let totalCess = 0;

      const processedItems = input.items.map((item) => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate) || 0;
        const discAmount = Number(item.discountAmount) || 0;
        const lineBase = Math.max(0, qty * rate - discAmount);

        const gstRate = Number(item.gstRatePercent) || 0;
        let cgst = Number(item.cgstAmount) || 0;
        let sgst = Number(item.sgstAmount) || 0;
        let igst = Number(item.igstAmount) || 0;
        const cess = Number(item.cessAmount) || 0;

        if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
          // Default: Intra-state split 50/50 CGST + SGST
          cgst = Math.round(((lineBase * (gstRate / 2)) / 100) * 100) / 100;
          sgst = Math.round(((lineBase * (gstRate / 2)) / 100) * 100) / 100;
        }

        const lineTotal = lineBase + cgst + sgst + igst + cess;

        subtotal += lineBase;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;
        totalCess += cess;

        return {
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          productName: item.productName || "Item",
          hsnOrSacCode: item.hsnOrSacCode || null,
          quantity: qty,
          unit: item.unit || "PCS",
          rate,
          mrp: item.mrp ?? rate,
          discountPercent: Number(item.discountPercent) || 0,
          discountAmount: discAmount,
          taxableValue: lineBase,
          gstRatePercent: gstRate,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          cessAmount: cess,
          lineTotal,
        };
      });

      // Overall discount
      const billDiscountAmount =
        input.discountAmount > 0
          ? input.discountAmount
          : input.discountPercent > 0
          ? Math.round(((subtotal * input.discountPercent) / 100) * 100) / 100
          : 0;

      const taxableValue = Math.max(0, subtotal - billDiscountAmount);

      // Re-adjust tax if bill-level discount was applied and not line-level
      if (input.cgstAmount > 0) totalCgst = input.cgstAmount;
      if (input.sgstAmount > 0) totalSgst = input.sgstAmount;
      if (input.igstAmount > 0) totalIgst = input.igstAmount;

      const unroundedGrand = taxableValue + totalCgst + totalSgst + totalIgst + totalCess;
      const roundedGrand = Math.round(unroundedGrand * 100) / 100;
      const roundOff = Math.round((roundedGrand - unroundedGrand) * 100) / 100;

      const grandTotal = input.grandTotal > 0 ? input.grandTotal : roundedGrand;
      const status = input.status || InvoiceStatus.SAVED;
      const isHeld = input.isHeld || status === InvoiceStatus.HELD;

      let paidAmount = Number(input.paidAmount) || 0;
      if (paidAmount === 0 && (status === InvoiceStatus.SAVED || status === InvoiceStatus.PRINTED) && !isHeld) {
        paidAmount = grandTotal;
      }

      const balanceAmount = Math.max(0, grandTotal - paidAmount);
      const changeReturned = Math.max(0, paidAmount - grandTotal);

      const paymentStatus =
        balanceAmount <= 0
          ? PaymentStatus.PAID
          : paidAmount > 0
          ? PaymentStatus.PARTIALLY_PAID
          : PaymentStatus.UNPAID;

      // 4. Create Invoice Record
      const invoice = await tx.invoice.create({
        data: {
          businessId,
          seriesId,
          invoiceNumber,
          invoiceDate: input.invoiceDate || new Date(),
          customerId: customerId || undefined,
          customerName,
          customerPhone,
          billingAddress: input.billingAddress,
          shippingAddress: input.shippingAddress,
          placeOfSupply: input.placeOfSupply,
          supplyType: input.supplyType || GstSupplyType.B2C,
          isReverseCharge: input.isReverseCharge ?? false,
          subtotal,
          discountPercent: input.discountPercent,
          discountAmount: billDiscountAmount,
          taxableValue,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          cessAmount: totalCess,
          roundOff,
          grandTotal,
          paidAmount,
          balanceAmount,
          changeReturned,
          amountInWords: input.amountInWords,
          paymentMode: input.paymentMode || PaymentMode.CASH,
          paymentStatus,
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
          status: isHeld ? InvoiceStatus.HELD : status,
          isHeld,
          createdByUserId: userId,
          items: {
            create: processedItems,
          },
        },
        include: invoiceInclude,
      });

      // 4b. Record in `sales` and `sale_items` tables
      const saleNumber = `SALE-${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "")}`;
      await tx.sale.create({
        data: {
          businessId,
          saleNumber,
          saleDate: input.invoiceDate || new Date(),
          customerId: customerId || undefined,
          customerName,
          customerPhone,
          billingAddress: input.billingAddress,
          shippingAddress: input.shippingAddress,
          placeOfSupply: input.placeOfSupply,
          warehouseId: input.warehouseId,
          subtotal,
          discountPercent: input.discountPercent,
          discountAmount: billDiscountAmount,
          taxableValue,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          cessAmount: totalCess,
          roundOff,
          grandTotal,
          paidAmount,
          balanceAmount,
          changeReturned,
          paymentMode: input.paymentMode || PaymentMode.CASH,
          paymentStatus,
          status: isHeld ? "HELD" : status === InvoiceStatus.DRAFT ? "DRAFT" : "COMPLETED",
          isHeld,
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
          invoiceId: invoice.id,
          createdByUserId: userId,
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              hsnOrSacCode: item.hsnOrSacCode,
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              mrp: item.mrp,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              taxableValue: item.taxableValue,
              gstRatePercent: item.gstRatePercent,
              cgstAmount: item.cgstAmount,
              sgstAmount: item.sgstAmount,
              igstAmount: item.igstAmount,
              cessAmount: item.cessAmount,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      // 5. Stock Movements (Deduct inventory for confirmed/printed sales if product exists)
      if (!isHeld && status !== InvoiceStatus.DRAFT) {
        const warehouseId = await this.resolveWarehouseId(businessId, input.warehouseId);
        if (warehouseId) {
          for (const item of processedItems) {
            if (item.productId) {
              await tx.stockMovement.create({
                data: {
                  businessId,
                  productId: item.productId,
                  warehouseId,
                  movementType: StockMovementType.SALES,
                  quantity: -Math.abs(item.quantity),
                  unitCost: item.rate,
                  referenceType: "INVOICE",
                  referenceId: invoice.id,
                },
              });
            }
          }
        }

        // Ledger Entry for registered customer
        if (customerId) {
          await tx.ledgerEntry.create({
            data: {
              businessId,
              customerId,
              entryType: LedgerEntryType.DEBIT,
              debitAmount: grandTotal,
              creditAmount: 0,
              particulars: `Sales Invoice ${invoiceNumber}`,
              referenceNumber: invoiceNumber,
              invoiceId: invoice.id,
            },
          });

          if (paidAmount > 0) {
            await tx.ledgerEntry.create({
              data: {
                businessId,
                customerId,
                entryType: LedgerEntryType.CREDIT,
                debitAmount: 0,
                creditAmount: paidAmount,
                particulars: `Payment received for ${invoiceNumber} (${input.paymentMode || "CASH"})`,
                referenceNumber: invoiceNumber,
                invoiceId: invoice.id,
              },
            });
          }
        }
      }

      return invoice;
    });
  }

  /**
   * Find single invoice by ID
   */
  async findById(businessId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        ...invoiceInclude,
        business: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
            gstin: true,
            email: true,
            mobileNumber: true,
            businessAddress: true,
            state: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new ErrorResponse("Invoice not found", 404);
    }
    return invoice;
  }

  /**
   * Query multiple sales invoices with filtering & pagination
   */
  async findMany(businessId: string, query: SalesInvoiceQueryParams) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { businessId };

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: s, mode: "insensitive" } },
        { customerName: { contains: s, mode: "insensitive" } },
        { customerPhone: { contains: s, mode: "insensitive" } },
        { notes: { contains: s, mode: "insensitive" } },
        { customer: { name: { contains: s, mode: "insensitive" } } },
      ];
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.isHeld !== undefined) {
      where.isHeld = query.isHeld;
    }

    if (query.fromDate || query.toDate) {
      where.invoiceDate = {};
      if (query.fromDate) {
        where.invoiceDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = to;
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Fast Hold / Park Bill
   */
  async holdCart(businessId: string, input: HoldSalesInvoiceInput, userId?: string) {
    const subtotal = input.items.reduce((sum, it) => sum + (it.rate * it.quantity), 0);
    const cgst = Math.round(subtotal * 0.025 * 100) / 100;
    const sgst = Math.round(subtotal * 0.025 * 100) / 100;
    const grandTotal = subtotal + cgst + sgst - (input.discountAmount || 0);

    return this.createSalesInvoice(
      businessId,
      {
        seriesId: null,
        invoiceNumber: null,
        invoiceDate: new Date(),
        customerId: null,
        customerName: input.customerName || "Walk-in Customer",
        customerPhone: input.customerPhone || null,
        billingAddress: null,
        shippingAddress: null,
        placeOfSupply: null,
        supplyType: GstSupplyType.B2C,
        isReverseCharge: false,
        subtotal,
        discountPercent: input.discountPercent || 0,
        discountAmount: input.discountAmount || 0,
        taxableValue: subtotal,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: 0,
        cessAmount: 0,
        roundOff: 0,
        grandTotal,
        paidAmount: 0,
        balanceAmount: grandTotal,
        changeReturned: 0,
        amountInWords: null,
        paymentMode: PaymentMode.CASH,
        paymentStatus: PaymentStatus.UNPAID,
        notes: input.notes || null,
        termsAndConditions: null,
        status: InvoiceStatus.HELD,
        isHeld: true,
        warehouseId: null,
        items: input.items,
      },
      userId
    );
  }

  /**
   * Fetch all parked / held invoices
   */
  async getHeldInvoices(businessId: string) {
    return prisma.invoice.findMany({
      where: {
        businessId,
        OR: [{ isHeld: true }, { status: InvoiceStatus.HELD }],
      },
      include: invoiceInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Resume a parked / held invoice into active cart
   */
  async resumeHeldInvoice(businessId: string, id: string) {
    const invoice = await this.findById(businessId, id);
    if (!invoice.isHeld && invoice.status !== InvoiceStatus.HELD) {
      throw new ErrorResponse("Selected invoice is not held", 400);
    }

    return prisma.invoice.update({
      where: { id },
      data: {
        isHeld: false,
        status: InvoiceStatus.SAVED,
      },
      include: invoiceInclude,
    });
  }

  /**
   * Update draft or held invoice
   */
  async updateSalesInvoice(
    businessId: string,
    id: string,
    input: UpdateSalesInvoiceInput,
    _userId?: string
  ) {
    const existing = await this.findById(businessId, id);

    if (existing.status === InvoiceStatus.CANCELLED) {
      throw new ErrorResponse("Cannot edit a cancelled invoice", 400);
    }

    return prisma.$transaction(async (tx) => {
      // If items updated, re-create items
      if (input.items && input.items.length > 0) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        const processedItems = input.items.map((item) => ({
          invoiceId: id,
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          productName: item.productName || "Item",
          hsnOrSacCode: item.hsnOrSacCode || null,
          quantity: item.quantity,
          unit: item.unit || "PCS",
          rate: item.rate,
          mrp: item.mrp ?? item.rate,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableValue: item.taxableValue,
          gstRatePercent: item.gstRatePercent,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          cessAmount: item.cessAmount,
          lineTotal: item.lineTotal,
        }));

        await tx.invoiceItem.createMany({ data: processedItems });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          notes: input.notes,
          termsAndConditions: input.termsAndConditions,
          status: input.status,
          isHeld: input.isHeld,
          subtotal: input.subtotal,
          discountPercent: input.discountPercent,
          discountAmount: input.discountAmount,
          taxableValue: input.taxableValue,
          cgstAmount: input.cgstAmount,
          sgstAmount: input.sgstAmount,
          igstAmount: input.igstAmount,
          grandTotal: input.grandTotal,
          paidAmount: input.paidAmount,
          balanceAmount: input.balanceAmount,
          changeReturned: input.changeReturned,
          paymentMode: input.paymentMode,
          paymentStatus: input.paymentStatus,
        },
        include: invoiceInclude,
      });

      return updated;
    });
  }

  /**
   * Update invoice status (e.g. SAVED -> PRINTED)
   */
  async updateStatus(businessId: string, id: string, status: InvoiceStatus) {
    await this.findById(businessId, id);
    return prisma.invoice.update({
      where: { id },
      data: { status, isHeld: status === InvoiceStatus.HELD },
      include: invoiceInclude,
    });
  }

  /**
   * Cancel an invoice and reverse stock movements
   */
  async cancelSalesInvoice(businessId: string, id: string) {
    const invoice = await this.findById(businessId, id);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ErrorResponse("Invoice is already cancelled", 400);
    }

    return prisma.$transaction(async (tx) => {
      // Revert stock deductions
      const movements = await tx.stockMovement.findMany({
        where: {
          businessId,
          referenceType: "INVOICE",
          referenceId: id,
          movementType: StockMovementType.SALES,
        },
      });

      for (const m of movements) {
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: m.productId,
            warehouseId: m.warehouseId,
            movementType: StockMovementType.SALES_RETURN,
            quantity: Math.abs(Number(m.quantity)),
            unitCost: m.unitCost,
            referenceType: "INVOICE_CANCEL",
            referenceId: id,
          },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          isHeld: false,
        },
        include: invoiceInclude,
      });
    });
  }

  /**
   * Delete draft or cancelled invoice
   */
  async deleteSalesInvoice(businessId: string, id: string) {
    const invoice = await this.findById(businessId, id);
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.CANCELLED && !invoice.isHeld) {
      throw new ErrorResponse("Only draft, held, or cancelled invoices can be deleted", 400);
    }

    // Clean up any stock movements if any exist
    await prisma.stockMovement.deleteMany({
      where: { referenceType: "INVOICE", referenceId: id },
    });

    return prisma.invoice.delete({ where: { id } });
  }

  /**
   * Daily sales and POS metrics summary
   */
  async getSalesMetrics(businessId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayInvoices, heldCount, totalInvoicesCount] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          businessId,
          createdAt: { gte: today },
          status: { not: InvoiceStatus.CANCELLED },
          isHeld: false,
        },
        select: { grandTotal: true, paidAmount: true },
      }),
      prisma.invoice.count({
        where: {
          businessId,
          OR: [{ isHeld: true }, { status: InvoiceStatus.HELD }],
        },
      }),
      prisma.invoice.count({
        where: { businessId },
      }),
    ]);

    const todaySales = todayInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
    const todayCollected = todayInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

    return {
      todaySales: Math.round(todaySales * 100) / 100,
      todayInvoicesCount: todayInvoices.length,
      todayCollected: Math.round(todayCollected * 100) / 100,
      activeHeldBillsCount: heldCount,
      totalInvoicesCount,
      averageTicketSize: todayInvoices.length > 0 ? Math.round((todaySales / todayInvoices.length) * 100) / 100 : 0,
    };
  }
}

export const salesInvoiceRepository = new SalesInvoiceRepository();
