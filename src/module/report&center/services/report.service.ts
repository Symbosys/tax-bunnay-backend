import { ErrorResponse } from "../../../utils/response.util";
import { reportRepository, ReportRepository } from "../repo/report.repo";
import type {
  CreateReportExportInput,
  CreateSavedReportInput,
  GstSummaryQueryParams,
  PurchaseRegisterQueryParams,
  SalesRegisterQueryParams,
  StockValuationQueryParams,
} from "../validators/report.validators";

export class ReportService {
  private repo: ReportRepository;

  constructor(repo: ReportRepository = reportRepository) {
    this.repo = repo;
  }

  /**
   * 1. Query Sales Register Log
   */
  async getSalesRegister(businessId: string, query: SalesRegisterQueryParams) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getSalesRegister(businessId, query);
  }

  /**
   * 2. Query Purchase Register Log
   */
  async getPurchaseRegister(businessId: string, query: PurchaseRegisterQueryParams) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getPurchaseRegister(businessId, query);
  }

  /**
   * 3. Query GST Sales Liability Summary
   */
  async getGstSummary(businessId: string, query: GstSummaryQueryParams) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getGstSummary(businessId, query);
  }

  /**
   * 4. Query Stock Asset Valuation
   */
  async getStockValuation(businessId: string, query: StockValuationQueryParams) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getStockValuation(businessId, query);
  }

  /**
   * 5. Catalog of available reports with UI metadata matching reports_page.dart
   */
  getReportsCatalog() {
    return [
      {
        id: "sales_register",
        title: "Sales Register",
        subtitle: "Invoice-wise sales & revenue log for selected period",
        category: "Sales",
        formats: ["Excel", "PDF", "CSV"],
        icon: "receipt_long_rounded",
        accentColor: "#2E7D32",
      },
      {
        id: "purchase_register",
        title: "Purchase Register",
        subtitle: "Supplier bills, inward goods & input tax credit log",
        category: "Purchases",
        formats: ["Excel", "PDF", "CSV"],
        icon: "shopping_cart_outlined",
        accentColor: "#1565C0",
      },
      {
        id: "gst_summary",
        title: "GST Liability Summary",
        subtitle: "Rate-wise GST (5%, 12%, 18%, 28%) collected on sales & GSTR-1 preview",
        category: "Taxation",
        formats: ["Excel", "PDF", "CSV"],
        icon: "percent",
        accentColor: "#6A1B9A",
      },
      {
        id: "stock_valuation",
        title: "Stock Valuation & Asset Summary",
        subtitle: "Inventory cost valuation by warehouse & SKU asset analysis",
        category: "Inventory",
        formats: ["Excel", "PDF", "CSV"],
        icon: "inventory_2_outlined",
        accentColor: "#00838F",
      },
    ];
  }

  /**
   * 6. Generate & Log Report Export
   */
  async exportReport(
    businessId: string,
    userId: string | undefined,
    input: CreateReportExportInput
  ) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required to export report", 400);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const rawName = input.reportName || input.reportType.toLowerCase();
    const sanitizedName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const extension = input.format === "PDF" ? "pdf" : "csv";
    const fileName = `${sanitizedName}_${timestamp}.${extension}`;

    let recordCount = 0;
    let exportRows: any[] = [];
    let headers: string[] = [];

    switch (input.reportType) {
      case "SALES_REGISTER": {
        const data = await this.repo.getSalesRegister(businessId, {
          startDate: input.startDate,
          endDate: input.endDate,
          warehouseId: input.warehouseId,
          sortBy: "invoiceDate",
          sortOrder: "desc",
          page: 1,
          limit: 10000,
        });
        recordCount = data.invoices.length;
        headers = [
          "Invoice Number",
          "Invoice Date",
          "Customer Name",
          "Taxable Amount",
          "GST Amount",
          "Grand Total",
          "Payment Mode",
          "Status",
        ];
        exportRows = data.invoices.map((inv) => ({
          "Invoice Number": inv.invoiceNumber,
          "Invoice Date": inv.invoiceDate.toISOString().slice(0, 10),
          "Customer Name": inv.customerName || inv.customer?.name || "Walk-in Customer",
          "Taxable Amount": Number(inv.taxableValue),
          "GST Amount": Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount),
          "Grand Total": Number(inv.grandTotal),
          "Payment Mode": inv.paymentMode || "CASH",
          "Status": inv.status,
        }));
        break;
      }

      case "PURCHASE_REGISTER": {
        const data = await this.repo.getPurchaseRegister(businessId, {
          startDate: input.startDate,
          endDate: input.endDate,
          warehouseId: input.warehouseId,
          sortBy: "purchaseDate",
          sortOrder: "desc",
          page: 1,
          limit: 10000,
        });
        recordCount = data.purchases.length;
        headers = [
          "Bill Number",
          "Purchase Date",
          "Supplier Name",
          "Taxable Value",
          "GST Input",
          "Total Value",
          "Payment Mode",
          "Status",
        ];
        exportRows = data.purchases.map((p) => ({
          "Bill Number": p.purchaseNumber || "-",
          "Purchase Date": p.purchaseDate.toISOString().slice(0, 10),
          "Supplier Name": p.supplier?.name || "Vendor",
          "Taxable Value": Number(p.taxableValue),
          "GST Input": Number(p.gstAmount) || (Number(p.cgstAmount) + Number(p.sgstAmount) + Number(p.igstAmount)),
          "Total Value": Number(p.totalAmount),
          "Payment Mode": p.paymentMode || "BANK",
          "Status": p.status,
        }));
        break;
      }

      case "GST_SUMMARY": {
        const data = await this.repo.getGstSummary(businessId, {
          startDate: input.startDate,
          endDate: input.endDate,
        });
        headers = ["Tax Slab", "Tax Rate (%)", "Taxable Base (₹)", "GST Output Liability (₹)"];
        exportRows = [
          { "Tax Slab": "GST 0% (Nil / Exempt)", "Tax Rate (%)": 0, "Taxable Base (₹)": data.slabs.gst0.taxable, "GST Output Liability (₹)": data.slabs.gst0.tax },
          { "Tax Slab": "GST 5%", "Tax Rate (%)": 5, "Taxable Base (₹)": data.slabs.gst5.taxable, "GST Output Liability (₹)": data.slabs.gst5.tax },
          { "Tax Slab": "GST 12%", "Tax Rate (%)": 12, "Taxable Base (₹)": data.slabs.gst12.taxable, "GST Output Liability (₹)": data.slabs.gst12.tax },
          { "Tax Slab": "GST 18%", "Tax Rate (%)": 18, "Taxable Base (₹)": data.slabs.gst18.taxable, "GST Output Liability (₹)": data.slabs.gst18.tax },
          { "Tax Slab": "GST 28%", "Tax Rate (%)": 28, "Taxable Base (₹)": data.slabs.gst28.taxable, "GST Output Liability (₹)": data.slabs.gst28.tax },
        ];
        recordCount = exportRows.length;
        break;
      }

      case "STOCK_VALUATION": {
        const data = await this.repo.getStockValuation(businessId, {
          warehouseId: input.warehouseId,
          page: 1,
          limit: 10000,
        });
        recordCount = data.products.length;
        headers = [
          "Product Name",
          "SKU",
          "Category",
          "Warehouse",
          "Stock Qty",
          "Unit",
          "Cost Price (₹)",
          "Asset Value (Cost) (₹)",
          "Selling Price (₹)",
        ];
        exportRows = data.products.map((prod) => ({
          "Product Name": prod.name,
          "SKU": prod.sku,
          "Category": prod.category,
          "Warehouse": prod.warehouseName,
          "Stock Qty": prod.currentStock,
          "Unit": prod.primaryUnit,
          "Cost Price (₹)": prod.purchasePrice,
          "Asset Value (Cost) (₹)": prod.assetValue,
          "Selling Price (₹)": prod.sellingPrice,
        }));
        break;
      }

      default:
        recordCount = 0;
        headers = ["Message"];
        exportRows = [{ Message: "Report Generated" }];
    }

    // Convert to CSV text representation for clean universal consumption
    const csvContent = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : "";
            return val.includes(",") || val.includes('"') || val.includes("\n")
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(",")
      ),
    ].join("\r\n");

    const fileSizeBytes = Buffer.byteLength(csvContent, "utf-8");

    // Save record to Database
    const exportRecord = await this.repo.createReportExport(businessId, userId, input, {
      fileName,
      fileSizeBytes,
      recordCount,
    });

    return {
      exportRecord,
      fileName,
      format: input.format,
      recordCount,
      fileSizeBytes,
      csvContent,
    };
  }

  /**
   * 7. Export History
   */
  async getReportExports(businessId: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getReportExports(businessId);
  }

  /**
   * 8. Saved Reports
   */
  async createSavedReport(businessId: string, input: CreateSavedReportInput) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.createSavedReport(businessId, input);
  }

  async getSavedReports(businessId: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required", 400);
    }
    return this.repo.getSavedReports(businessId);
  }

  async deleteSavedReport(businessId: string, id: string) {
    if (!businessId || !id) {
      throw new ErrorResponse("Business ID and Report ID are required", 400);
    }
    return this.repo.deleteSavedReport(businessId, id);
  }
}

export const reportService = new ReportService();
