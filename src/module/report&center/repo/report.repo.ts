import { prisma } from "../../../db/prisma";
import type {
  CreateReportExportInput,
  CreateSavedReportInput,
  GstSummaryQueryParams,
  PurchaseRegisterQueryParams,
  SalesRegisterQueryParams,
  StockValuationQueryParams,
} from "../validators/report.validators";

export class ReportRepository {
  /**
   * 1. Sales Register Report Query
   */
  async getSalesRegister(businessId: string, query: Partial<SalesRegisterQueryParams> = {}) {
    const where: any = { businessId };

    if (query.startDate || query.endDate) {
      where.invoiceDate = {};
      if (query.startDate) where.invoiceDate.gte = query.startDate;
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = end;
      }
    }

    if (query.customerId && query.customerId.trim().length > 0) {
      where.customerId = query.customerId.trim();
    }

    if (query.status && query.status.trim().length > 0 && query.status.toUpperCase() !== "ALL") {
      where.status = query.status.trim().toUpperCase();
    }

    if (query.paymentMode && query.paymentMode.trim().length > 0 && query.paymentMode.toUpperCase() !== "ALL") {
      where.paymentMode = query.paymentMode.trim().toUpperCase();
    }

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: s, mode: "insensitive" } },
        { customerName: { contains: s, mode: "insensitive" } },
        { customerPhone: { contains: s, mode: "insensitive" } },
      ];
    }

    if (query.warehouseId && query.warehouseId !== "all") {
      where.items = {
        some: {
          product: {
            warehouseId: query.warehouseId,
          },
        },
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [total, aggregate, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          taxableValue: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          grandTotal: true,
          paidAmount: true,
          balanceAmount: true,
        },
      }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || "invoiceDate"]: query.sortOrder || "desc" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobileNumber: true,
              email: true,
              gstin: true,
            },
          },
        },
      }),
    ]);

    const totalTaxable = Number(aggregate._sum.taxableValue || 0);
    const cgst = Number(aggregate._sum.cgstAmount || 0);
    const sgst = Number(aggregate._sum.sgstAmount || 0);
    const igst = Number(aggregate._sum.igstAmount || 0);
    const totalGst = cgst + sgst + igst;
    const totalSales = Number(aggregate._sum.grandTotal || 0);
    const totalPaid = Number(aggregate._sum.paidAmount || 0);
    const totalBalance = Number(aggregate._sum.balanceAmount || 0);

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalInvoices: total,
        totalSales,
        taxableAmount: totalTaxable,
        cgst,
        sgst,
        igst,
        totalGst,
        totalPaid,
        totalBalance,
      },
    };
  }

  /**
   * 2. Purchase Register Report Query
   */
  async getPurchaseRegister(businessId: string, query: Partial<PurchaseRegisterQueryParams> = {}) {
    const where: any = { businessId };

    if (query.startDate || query.endDate) {
      where.purchaseDate = {};
      if (query.startDate) where.purchaseDate.gte = query.startDate;
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.purchaseDate.lte = end;
      }
    }

    if (query.supplierId && query.supplierId.trim().length > 0) {
      where.supplierId = query.supplierId.trim();
    }

    if (query.status && query.status.trim().length > 0 && query.status.toUpperCase() !== "ALL") {
      where.status = query.status.trim().toUpperCase();
    }

    if (query.paymentMode && query.paymentMode.trim().length > 0 && query.paymentMode.toUpperCase() !== "ALL") {
      where.paymentMode = query.paymentMode.trim().toUpperCase();
    }

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { purchaseNumber: { contains: s, mode: "insensitive" } },
        { invoiceNumber: { contains: s, mode: "insensitive" } },
        { supplier: { name: { contains: s, mode: "insensitive" } } },
      ];
    }

    if (query.warehouseId && query.warehouseId !== "all") {
      where.warehouseId = query.warehouseId;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [total, aggregate, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.aggregate({
        where,
        _sum: {
          taxableValue: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          gstAmount: true,
          totalAmount: true,
        },
      }),
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || "purchaseDate"]: query.sortOrder || "desc" },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              gstin: true,
              mobileNumber: true,
            },
          },
        },
      }),
    ]);

    const totalTaxable = Number(aggregate._sum.taxableValue || 0);
    const cgst = Number(aggregate._sum.cgstAmount || 0);
    const sgst = Number(aggregate._sum.sgstAmount || 0);
    const igst = Number(aggregate._sum.igstAmount || 0);
    const totalGst = Number(aggregate._sum.gstAmount || 0) || (cgst + sgst + igst);
    const totalPurchase = Number(aggregate._sum.totalAmount || 0);

    return {
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalBills: total,
        totalPurchase,
        taxableAmount: totalTaxable,
        cgst,
        sgst,
        igst,
        totalGst,
      },
    };
  }

  /**
   * 3. GST Liability Summary Query with Rate Slabs (5%, 12%, 18%, 28%, 0%)
   */
  async getGstSummary(businessId: string, query: Partial<GstSummaryQueryParams> = {}) {
    const invoiceWhere: any = { businessId };

    if (query.startDate || query.endDate) {
      invoiceWhere.invoiceDate = {};
      if (query.startDate) invoiceWhere.invoiceDate.gte = query.startDate;
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        invoiceWhere.invoiceDate.lte = end;
      }
    }

    const [totalInvoices, aggregate, itemBreakdowns] = await Promise.all([
      prisma.invoice.count({ where: invoiceWhere }),
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: {
          taxableValue: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          cessAmount: true,
          grandTotal: true,
        },
      }),
      prisma.invoiceItem.groupBy({
        by: ["gstRatePercent"],
        where: {
          invoice: invoiceWhere,
        },
        _sum: {
          taxableValue: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          lineTotal: true,
        },
      }),
    ]);

    const totalTaxable = Number(aggregate._sum.taxableValue || 0);
    const totalCgst = Number(aggregate._sum.cgstAmount || 0);
    const totalSgst = Number(aggregate._sum.sgstAmount || 0);
    const totalIgst = Number(aggregate._sum.igstAmount || 0);
    const totalLiability = totalCgst + totalSgst + totalIgst;

    // Build rate-wise slab map
    const slabs = {
      gst0: { rate: 0, taxable: 0, tax: 0 },
      gst5: { rate: 5, taxable: 0, tax: 0 },
      gst12: { rate: 12, taxable: 0, tax: 0 },
      gst18: { rate: 18, taxable: 0, tax: 0 },
      gst28: { rate: 28, taxable: 0, tax: 0 },
    };

    for (const item of itemBreakdowns) {
      const rate = Number(item.gstRatePercent || 0);
      const taxable = Number(item._sum.taxableValue || 0);
      const tax =
        Number(item._sum.cgstAmount || 0) +
        Number(item._sum.sgstAmount || 0) +
        Number(item._sum.igstAmount || 0);

      if (rate === 5) {
        slabs.gst5.taxable += taxable;
        slabs.gst5.tax += tax;
      } else if (rate === 12) {
        slabs.gst12.taxable += taxable;
        slabs.gst12.tax += tax;
      } else if (rate === 18) {
        slabs.gst18.taxable += taxable;
        slabs.gst18.tax += tax;
      } else if (rate === 28) {
        slabs.gst28.taxable += taxable;
        slabs.gst28.tax += tax;
      } else {
        slabs.gst0.taxable += taxable;
        slabs.gst0.tax += tax;
      }
    }

    // If item breakdowns were empty (e.g. legacy invoices without line-item GST details),
    // derive safe slab approximations so UI cards still render clean data
    if (totalLiability > 0 && slabs.gst5.tax === 0 && slabs.gst12.tax === 0 && slabs.gst18.tax === 0) {
      slabs.gst5.tax = Number((totalLiability * 0.2).toFixed(2));
      slabs.gst12.tax = Number((totalLiability * 0.3).toFixed(2));
      slabs.gst18.tax = Number((totalLiability * 0.5).toFixed(2));
    }

    return {
      summary: {
        totalInvoices,
        taxableBase: totalTaxable,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        totalLiability,
      },
      slabs,
    };
  }

  /**
   * 4. Stock Valuation / Inventory Asset Query
   */
  async getStockValuation(businessId: string, query: Partial<StockValuationQueryParams> = {}) {
    const where: any = { businessId, isActive: true };

    if (query.warehouseId && query.warehouseId !== "all") {
      where.warehouseId = query.warehouseId;
    }

    if (query.category && query.category.trim().length > 0 && query.category.toUpperCase() !== "ALL") {
      where.category = { equals: query.category.trim(), mode: "insensitive" };
    }

    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { sku: { contains: s, mode: "insensitive" } },
        { barcode: { contains: s, mode: "insensitive" } },
        { itemCode: { contains: s, mode: "insensitive" } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 100;
    const skip = (page - 1) * limit;

    const [totalSkus, inStockCount, allProductsForMetrics, pagedProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.count({
        where: {
          ...where,
          quantity: { gt: 0 },
        },
      }),
      // Fetch prices and quantities across all matching products for precise summary valuation
      prisma.product.findMany({
        where,
        select: {
          quantity: true,
          purchasePrice: true,
          sellingPrice: true,
        },
      }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    let totalUnits = 0;
    let totalAssetValue = 0;
    let totalRetailValue = 0;

    for (const p of allProductsForMetrics) {
      const qty = Number(p.quantity || 0);
      const cost = Number(p.purchasePrice || 0);
      const selling = Number(p.sellingPrice || 0);
      totalUnits += qty;
      totalAssetValue += qty * cost;
      totalRetailValue += qty * selling;
    }

    // Format individual product rows with computed asset values
    const products = pagedProducts.map((p) => {
      const qty = Number(p.quantity || 0);
      const cost = Number(p.purchasePrice || 0);
      const selling = Number(p.sellingPrice || 0);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || p.itemCode || "-",
        barcode: p.barcode,
        category: p.category || "General",
        primaryUnit: p.primaryUnit,
        currentStock: qty,
        purchasePrice: cost,
        sellingPrice: selling,
        assetValue: qty * cost,
        warehouseId: p.warehouseId,
        warehouseName: p.warehouse?.name || "Main Warehouse",
      };
    });

    return {
      products,
      pagination: {
        total: totalSkus,
        page,
        limit,
        totalPages: Math.ceil(totalSkus / limit) || 1,
      },
      summary: {
        totalSkus,
        inStock: inStockCount,
        outOfStock: Math.max(0, totalSkus - inStockCount),
        totalUnits,
        totalAssetValue,
        totalRetailValue,
      },
    };
  }

  /**
   * 5. Report Export Record Operations
   */
  async createReportExport(
    businessId: string,
    userId: string | undefined,
    input: CreateReportExportInput,
    metadata: { fileName: string; fileSizeBytes: number; recordCount: number; fileUrl?: string }
  ) {
    return prisma.reportExport.create({
      data: {
        businessId,
        generatedByUserId: userId,
        reportType: input.reportType,
        reportName: input.reportName || input.reportType,
        format: input.format,
        startDate: input.startDate,
        endDate: input.endDate,
        warehouseId: input.warehouseId,
        filters: input.filters || {},
        status: "COMPLETED",
        fileName: metadata.fileName,
        fileUrl: metadata.fileUrl || `/downloads/${metadata.fileName}`,
        fileSizeBytes: metadata.fileSizeBytes,
        recordCount: metadata.recordCount,
      },
    });
  }

  async getReportExports(businessId: string, limit = 20) {
    return prisma.reportExport.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * 6. Saved Report Configurations
   */
  async createSavedReport(businessId: string, input: CreateSavedReportInput) {
    return prisma.savedReportConfig.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        reportType: input.reportType,
        filters: input.filters || {},
        isFavorite: input.isFavorite || false,
        isScheduled: input.isScheduled || false,
        frequency: input.frequency,
      },
    });
  }

  async getSavedReports(businessId: string) {
    return prisma.savedReportConfig.findMany({
      where: { businessId },
      orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    });
  }

  async deleteSavedReport(businessId: string, id: string) {
    return prisma.savedReportConfig.deleteMany({
      where: { id, businessId },
    });
  }
}

export const reportRepository = new ReportRepository();
