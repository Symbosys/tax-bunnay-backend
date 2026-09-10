import { prisma } from "../../../../db/prisma";
import {
  LedgerEntryType,
  SalesReturnStatus,
  StockMovementType,
} from "../../../../generated/prisma/enums";
import { ErrorResponse } from "../../../../utils/response.util";
import type {
  CreateSalesReturnInput,
  SalesReturnItemInput,
  SalesReturnQueryParams,
  UpdateSalesReturnInput,
} from "../validators/sales-return.validators";

const salesReturnInclude = {
  items: {
    orderBy: { id: "asc" as const },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      customerName: true,
      grandTotal: true,
    },
  },
  creditNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      amount: true,
    },
  },
};

export class SalesReturnRepository {
  /**
   * Helper: Resolve active warehouse for inventory restocking
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
   * Auto-generates the next sequential Credit Note / Return Number
   */
  async getNextReturnNumber(businessId: string) {
    const currentYear = new Date().getFullYear();
    const nextYear = (currentYear + 1).toString().slice(-2);
    const fyTag = `${currentYear.toString().slice(-2)}-${nextYear}`;

    const count = await prisma.salesReturn.count({
      where: { businessId },
    });
    const nextSeq = count + 1;
    const formatted = `CN/${fyTag}/${String(nextSeq).padStart(4, "0")}`;

    return {
      prefix: "CN",
      financialYearTag: fyTag,
      nextSequence: nextSeq,
      returnNumber: formatted,
    };
  }

  /**
   * Create a new Sales Return (Credit Note)
   */
  async createSalesReturn(
    businessId: string,
    input: CreateSalesReturnInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve Return Number
      let returnNumber = input.returnNumber?.trim();
      if (!returnNumber) {
        const next = await this.getNextReturnNumber(businessId);
        returnNumber = next.returnNumber;
      }

      // Check uniqueness
      const existing = await tx.salesReturn.findUnique({
        where: {
          businessId_returnNumber: {
            businessId,
            returnNumber,
          },
        },
      });
      if (existing) {
        throw new ErrorResponse(
          `Sales return / credit note with number "${returnNumber}" already exists`,
          409
        );
      }

      // 2. Resolve original invoice if ID or number was provided
      let invoiceId = input.invoiceId || input.originalInvoiceId || null;
      if (invoiceId) {
        const inv = await tx.invoice.findFirst({
          where: {
            businessId,
            OR: [{ id: invoiceId }, { invoiceNumber: invoiceId }],
          },
          select: { id: true, invoiceNumber: true, customerId: true, customerName: true },
        });
        if (inv) {
          invoiceId = inv.id;
        }
      }

      // 3. Process line items
      let subtotal = 0;
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      let totalCess = 0;

      const processedItems = input.items.map((it: SalesReturnItemInput) => {
        const qty = Number(it.quantity) || 1;
        const rate = Number(it.rate) || 0;
        const rawLine = qty * rate;

        let discAmt = Number(it.discountAmount) || 0;
        const discPct = Number(it.discountPercentage) || 0;
        if (discPct > 0 && discAmt === 0) {
          discAmt = (rawLine * discPct) / 100;
        }

        const taxable = Math.max(0, rawLine - discAmt);
        const gstRate = Number(it.gstRatePercent ?? it.gstRate ?? 0);

        let cgst = Number(it.cgstAmount) || 0;
        let sgst = Number(it.sgstAmount) || 0;
        let igst = Number(it.igstAmount) || 0;
        let cess = Number(it.cessAmount) || 0;

        if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
          // Default intra-state split (CGST + SGST)
          const halfRate = gstRate / 2;
          cgst = (taxable * halfRate) / 100;
          sgst = (taxable * halfRate) / 100;
        }

        const lineTotal = Number(it.lineTotal) || taxable + cgst + sgst + igst + cess;

        subtotal += rawLine;
        totalTaxable += taxable;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;
        totalCess += cess;

        return {
          productId: it.productId || null,
          serviceId: it.serviceId || null,
          productName: it.productName || it.name || "Item",
          hsnSac: it.hsnSac || null,
          unit: it.unit || "PCS",
          quantity: qty,
          rate,
          discountPercentage: discPct,
          discountAmount: discAmt,
          taxableValue: taxable,
          gstRatePercent: gstRate,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          cessAmount: cess,
          lineTotal,
          reason: it.reason || input.reason || null,
          stockRestocked: false,
        };
      });

      const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
      const computedGross = totalTaxable + totalTax;
      const roundOff = input.roundOff !== undefined ? Number(input.roundOff) : Math.round(computedGross) - computedGross;
      const grandTotal = Number(input.totalAmount ?? input.grandTotal) || (computedGross + roundOff);

      const status = input.status || SalesReturnStatus.DRAFT;
      const warehouseId = await this.resolveWarehouseId(businessId, input.warehouseId);

      // 4. Create SalesReturn Record
      const salesReturn = await tx.salesReturn.create({
        data: {
          businessId,
          returnNumber,
          returnDate: input.returnDate || new Date(),
          invoiceId,
          customerId: input.customerId || null,
          customerName: input.customerName || "Walk-in Customer",
          customerPhone: input.customerPhone || null,
          billingAddress: input.billingAddress || null,
          shippingAddress: input.shippingAddress || null,
          placeOfSupply: input.placeOfSupply || null,
          status,
          reason: input.reason || null,
          refundMode: input.refundMode || "Credit Note (Store Credit)",
          warehouseId,
          subtotal: input.subtotal || subtotal,
          discountAmount: input.discountAmount || 0,
          taxableValue: input.taxableValue || totalTaxable,
          cgstAmount: input.cgstAmount || totalCgst,
          sgstAmount: input.sgstAmount || totalSgst,
          igstAmount: input.igstAmount || totalIgst,
          cessAmount: input.cessAmount || totalCess,
          roundOff,
          totalAmount: grandTotal,
          amountRefunded: input.amountRefunded || 0,
          notes: input.notes || null,
          termsConditions: input.termsConditions || null,
          createdByUserId: userId || null,
          items: {
            createMany: {
              data: processedItems,
            },
          },
        },
      });

      // 5. If created directly as CONFIRMED, perform inventory restock & ledger balance adjustment
      if (status === SalesReturnStatus.CONFIRMED) {
        await this.executeConfirmActions(tx, businessId, salesReturn.id, warehouseId, grandTotal, input.customerId, returnNumber, input.reason);
      }

      return tx.salesReturn.findUniqueOrThrow({
        where: { id: salesReturn.id },
        include: salesReturnInclude,
      });
    });
  }

  /**
   * Internal helper to execute confirmation actions (inventory restock, customer balance adjustment, credit note creation)
   */
  private async executeConfirmActions(
    tx: any,
    businessId: string,
    salesReturnId: string,
    warehouseId: string | null,
    totalAmount: number,
    customerId?: string | null,
    returnNumber?: string,
    reason?: string | null
  ) {
    // 1. Fetch items
    const items = await tx.salesReturnItem.findMany({
      where: { salesReturnId },
    });

    // 2. Restock physical products to warehouse
    if (warehouseId) {
      for (const it of items) {
        if (it.productId && !it.stockRestocked) {
          const qty = Math.abs(Number(it.quantity));
          if (qty > 0) {
            await tx.stockMovement.create({
              data: {
                businessId,
                productId: it.productId,
                warehouseId,
                movementType: StockMovementType.SALES_RETURN,
                quantity: qty, // positive = stock in
                unitCost: it.rate,
                referenceType: "SALES_RETURN",
                referenceId: salesReturnId,
              },
            });

            await tx.salesReturnItem.update({
              where: { id: it.id },
              data: { stockRestocked: true },
            });
          }
        }
      }
    }

    // 3. Customer Ledger entry for credit note
    if (customerId) {
      await tx.ledgerEntry.create({
        data: {
          businessId,
          customerId,
          entryType: LedgerEntryType.CREDIT,
          particulars: `Sale Return ${returnNumber || ""} (Credit Note)`,
          referenceNumber: returnNumber || null,
          debitAmount: 0,
          creditAmount: totalAmount,
        },
      });
    }

    // 4. Generate matching CreditNote record
    const noteNum = returnNumber || `CN-${salesReturnId.slice(-6)}`;
    const existingNote = await tx.creditNote.findUnique({
      where: {
        businessId_noteNumber: {
          businessId,
          noteNumber: noteNum,
        },
      },
    });

    if (!existingNote) {
      await tx.creditNote.create({
        data: {
          businessId,
          noteNumber: noteNum,
          noteDate: new Date(),
          customerId: customerId || null,
          salesReturnId,
          amount: totalAmount,
          reason: reason || "Sales Return Goods Restocked",
        },
      });
    }
  }

  /**
   * Search, filter, and paginate Sales Returns
   */
  async findMany(businessId: string, query: SalesReturnQueryParams) {
    const {
      q,
      search,
      status,
      customerId,
      invoiceId,
      warehouseId,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = query;

    const searchTerm = (q || search || "").trim();
    const where: any = { businessId };

    if (searchTerm) {
      where.OR = [
        { returnNumber: { contains: searchTerm, mode: "insensitive" } },
        { customerName: { contains: searchTerm, mode: "insensitive" } },
        { customerPhone: { contains: searchTerm, mode: "insensitive" } },
        { reason: { contains: searchTerm, mode: "insensitive" } },
        { notes: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    if (status && status.toLowerCase() !== "all") {
      const normalized = status.toUpperCase().replace(/[\s-]/g, "_");
      if (Object.values(SalesReturnStatus).includes(normalized as any)) {
        where.status = normalized;
      }
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (fromDate || toDate) {
      where.returnDate = {};
      if (fromDate) {
        where.returnDate.gte = new Date(fromDate);
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.returnDate.lte = to;
      }
    }

    const skip = (page - 1) * limit;

    const [total, returns] = await Promise.all([
      prisma.salesReturn.count({ where }),
      prisma.salesReturn.findMany({
        where,
        include: salesReturnInclude,
        orderBy: { returnDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single Sales Return by ID or returnNumber
   */
  async findById(businessId: string, id: string) {
    const returnRecord = await prisma.salesReturn.findFirst({
      where: {
        businessId,
        OR: [{ id }, { returnNumber: id }],
      },
      include: salesReturnInclude,
    });

    if (!returnRecord) {
      throw new ErrorResponse(`Sales return "${id}" not found`, 404);
    }

    return returnRecord;
  }

  /**
   * Update draft Sales Return
   */
  async updateSalesReturn(
    businessId: string,
    id: string,
    input: UpdateSalesReturnInput,
    _userId?: string
  ) {
    const existing = await this.findById(businessId, id);

    if (existing.status === SalesReturnStatus.CANCELLED) {
      throw new ErrorResponse("Cannot update a cancelled sales return", 400);
    }

    if (existing.status === SalesReturnStatus.CONFIRMED && input.items) {
      throw new ErrorResponse(
        "Cannot modify items on a confirmed sales return. Cancel it first to adjust quantities.",
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      let itemsData = undefined;
      let totalTaxable = Number(existing.taxableValue);
      let grandTotal = Number(existing.totalAmount);

      if (input.items && input.items.length > 0) {
        // Delete old items and insert updated items
        await tx.salesReturnItem.deleteMany({
          where: { salesReturnId: existing.id },
        });

        let subtotal = 0;
        totalTaxable = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalCess = 0;

        const processed = input.items.map((it) => {
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate) || 0;
          const rawLine = qty * rate;
          let discAmt = Number(it.discountAmount) || 0;
          const discPct = Number(it.discountPercentage) || 0;
          if (discPct > 0 && discAmt === 0) discAmt = (rawLine * discPct) / 100;
          const taxable = Math.max(0, rawLine - discAmt);
          const gstRate = Number(it.gstRatePercent ?? it.gstRate ?? 0);

          let cgst = Number(it.cgstAmount) || 0;
          let sgst = Number(it.sgstAmount) || 0;
          let igst = Number(it.igstAmount) || 0;
          let cess = Number(it.cessAmount) || 0;

          if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
            cgst = (taxable * (gstRate / 2)) / 100;
            sgst = (taxable * (gstRate / 2)) / 100;
          }

          const lineTotal = Number(it.lineTotal) || taxable + cgst + sgst + igst + cess;

          subtotal += rawLine;
          totalTaxable += taxable;
          totalCgst += cgst;
          totalSgst += sgst;
          totalIgst += igst;
          totalCess += cess;

          return {
            salesReturnId: existing.id,
            productId: it.productId || null,
            serviceId: it.serviceId || null,
            productName: it.productName || it.name || "Item",
            hsnSac: it.hsnSac || null,
            unit: it.unit || "PCS",
            quantity: qty,
            rate,
            discountPercentage: discPct,
            discountAmount: discAmt,
            taxableValue: taxable,
            gstRatePercent: gstRate,
            cgstAmount: cgst,
            sgstAmount: sgst,
            igstAmount: igst,
            cessAmount: cess,
            lineTotal,
            reason: it.reason || input.reason || existing.reason || null,
            stockRestocked: false,
          };
        });

        await tx.salesReturnItem.createMany({ data: processed });

        const totalTax = totalCgst + totalSgst + totalIgst + totalCess;
        const gross = totalTaxable + totalTax;
        const roundOff = input.roundOff !== undefined ? Number(input.roundOff) : Math.round(gross) - gross;
        grandTotal = gross + roundOff;
      }

      const updated = await tx.salesReturn.update({
        where: { id: existing.id },
        data: {
          returnNumber: input.returnNumber || undefined,
          returnDate: input.returnDate ? new Date(input.returnDate) : undefined,
          customerId: input.customerId !== undefined ? input.customerId : undefined,
          customerName: input.customerName || undefined,
          customerPhone: input.customerPhone || undefined,
          billingAddress: input.billingAddress || undefined,
          shippingAddress: input.shippingAddress || undefined,
          placeOfSupply: input.placeOfSupply || undefined,
          reason: input.reason || undefined,
          refundMode: input.refundMode || undefined,
          warehouseId: input.warehouseId || undefined,
          notes: input.notes || undefined,
          termsConditions: input.termsConditions || undefined,
          ...(input.items ? { taxableValue: totalTaxable, totalAmount: grandTotal } : {}),
        },
        include: salesReturnInclude,
      });

      return updated;
    });
  }

  /**
   * Confirm a draft Sales Return (Restocks inventory & creates Credit Note)
   */
  async confirmSalesReturn(businessId: string, id: string, _userId?: string) {
    const existing = await this.findById(businessId, id);

    if (existing.status === SalesReturnStatus.CONFIRMED) {
      return existing;
    }
    if (existing.status === SalesReturnStatus.CANCELLED) {
      throw new ErrorResponse("Cannot confirm a cancelled sales return", 400);
    }

    return prisma.$transaction(async (tx) => {
      const warehouseId = await this.resolveWarehouseId(businessId, existing.warehouseId);
      const grandTotal = Number(existing.totalAmount || 0);

      await this.executeConfirmActions(
        tx,
        businessId,
        existing.id,
        warehouseId,
        grandTotal,
        existing.customerId,
        existing.returnNumber,
        existing.reason
      );

      return tx.salesReturn.update({
        where: { id: existing.id },
        data: { status: SalesReturnStatus.CONFIRMED },
        include: salesReturnInclude,
      });
    });
  }

  /**
   * Cancel a Sales Return (Reverses restocked stock & customer balance)
   */
  async cancelSalesReturn(businessId: string, id: string, _userId?: string) {
    const existing = await this.findById(businessId, id);

    if (existing.status === SalesReturnStatus.CANCELLED) {
      return existing;
    }

    return prisma.$transaction(async (tx) => {
      // If was previously CONFIRMED, revert the stock and customer balance adjustments
      if (existing.status === SalesReturnStatus.CONFIRMED) {
        const warehouseId = await this.resolveWarehouseId(businessId, existing.warehouseId);
        const grandTotal = Number(existing.totalAmount || 0);

        // 1. Deduct the inventory that was restocked
        if (warehouseId) {
          for (const it of existing.items) {
            if (it.productId && it.stockRestocked) {
              const qty = Math.abs(Number(it.quantity));
              await tx.stockMovement.create({
                data: {
                  businessId,
                  productId: it.productId,
                  warehouseId,
                  movementType: StockMovementType.STOCK_ADJUSTMENT,
                  quantity: -qty, // negative to revert restock
                  unitCost: it.rate,
                  referenceType: "SALES_RETURN_CANCELLED",
                  referenceId: existing.id,
                },
              });

              await tx.salesReturnItem.update({
                where: { id: it.id },
                data: { stockRestocked: false },
              });
            }
          }
        }

        // 2. Ledger reversal
        if (existing.customerId) {
          await tx.ledgerEntry.create({
            data: {
              businessId,
              customerId: existing.customerId,
              entryType: LedgerEntryType.DEBIT,
              particulars: `Cancelled Return ${existing.returnNumber} (Reversal)`,
              referenceNumber: existing.returnNumber || null,
              debitAmount: grandTotal,
              creditAmount: 0,
            },
          });
        }
      }

      return tx.salesReturn.update({
        where: { id: existing.id },
        data: { status: SalesReturnStatus.CANCELLED },
        include: salesReturnInclude,
      });
    });
  }

  /**
   * Delete a draft or cancelled Sales Return
   */
  async deleteSalesReturn(businessId: string, id: string) {
    const existing = await this.findById(businessId, id);

    if (existing.status === SalesReturnStatus.CONFIRMED) {
      throw new ErrorResponse(
        "Cannot delete a confirmed sales return. Cancel it first to reverse stock and balances.",
        400
      );
    }

    await prisma.salesReturn.delete({
      where: { id: existing.id },
    });

    return {
      success: true,
      message: `Sales return ${existing.returnNumber} deleted successfully`,
    };
  }

  /**
   * Aggregate return metrics matching Sales Return UI summary cards
   */
  async getMetrics(businessId: string) {
    const allReturns = await prisma.salesReturn.findMany({
      where: { businessId },
      include: {
        items: {
          select: { quantity: true, stockRestocked: true },
        },
      },
    });

    const confirmed = allReturns.filter((r) => r.status === SalesReturnStatus.CONFIRMED);
    const draft = allReturns.filter((r) => r.status === SalesReturnStatus.DRAFT);
    const cancelled = allReturns.filter((r) => r.status === SalesReturnStatus.CANCELLED);

    const totalReturnValue = confirmed.reduce(
      (sum, r) => sum + Number(r.totalAmount || 0),
      0
    );

    const itemsRestocked = confirmed.reduce((sum, r) => {
      const lineQty = r.items.reduce((iSum, it) => iSum + Number(it.quantity || 0), 0);
      return sum + lineQty;
    }, 0);

    return {
      totalReturnValue: Math.round(totalReturnValue * 100) / 100,
      confirmedCount: confirmed.length,
      draftCount: draft.length,
      cancelledCount: cancelled.length,
      itemsRestocked: Math.round(itemsRestocked * 100) / 100,
      totalCount: allReturns.length,
    };
  }
}

export const salesReturnRepository = new SalesReturnRepository();
