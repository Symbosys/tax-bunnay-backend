import {
  financialStatementsRepo,
  FinancialStatementsRepo,
  type FinancialStatementRecord,
  type FinancialStatementSummaryRecord,
  type ProfitTrendPointRecord,
} from "../repo/financial-statements.repo";
import {
  normalizeReportType,
  type CustomReportInput,
  type ExportStatementQueryInput,
  type FinancialStatementQueryInput,
  type SaveLayoutInput,
  type ScheduleReportInput,
} from "../validators/financial-statements.validators";

export class FinancialStatementsService {
  private repo: FinancialStatementsRepo;

  constructor(repo: FinancialStatementsRepo = financialStatementsRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format currency for CSV/reports
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * 1. Get full Financial Statement data
   */
  async getFinancialStatement(
    businessId: string,
    query: FinancialStatementQueryInput
  ): Promise<FinancialStatementRecord> {
    const reportType = normalizeReportType(query.reportType);
    const dateRangeLabel = query.dateRangeLabel || "01 Apr 2026 – 31 May 2026";
    const compareWith = query.compareWith || "Previous Period";
    const trendPeriod = query.trendPeriod || "Last 6 Months";

    const statement = await this.repo.getFinancialStatement(businessId, {
      reportType,
      dateRangeLabel,
      compareWith,
      trendPeriod,
    });

    // If trendPeriod is 12 Months or This Year, adapt trend points
    if (trendPeriod === "Last 12 Months") {
      statement.trendPoints = [
        { month: "Jun 2025", amount: 95000.0, label: "₹0.95L" },
        { month: "Jul 2025", amount: 120000.0, label: "₹1.2L" },
        { month: "Aug 2025", amount: 135000.0, label: "₹1.35L" },
        { month: "Sep 2025", amount: 150000.0, label: "₹1.5L" },
        { month: "Oct 2025", amount: 140000.0, label: "₹1.4L" },
        { month: "Nov 2025", amount: 165000.0, label: "₹1.65L" },
        ...statement.trendPoints,
      ];
    } else if (trendPeriod === "This Year") {
      statement.trendPoints = [
        { month: "Jan 2026", amount: 185000.0, label: "₹1.85L" },
        { month: "Feb 2026", amount: 170000.0, label: "₹1.7L" },
        { month: "Mar 2026", amount: 280000.0, label: "₹2.8L" },
        { month: "Apr 2026", amount: 172000.0, label: "₹1.72L" },
        { month: "May 2026", amount: 293480.0, label: "₹2.93L" },
      ];
    }

    return statement;
  }

  /**
   * 2. Get Financial Summary KPIs and Donut Chart Breakdown
   */
  async getFinancialSummary(
    businessId: string,
    query: FinancialStatementQueryInput
  ): Promise<FinancialStatementSummaryRecord & {
    donutBreakdown: Array<{ name: string; amount: number; percentage: number; color: string }>;
  }> {
    const statement = await this.getFinancialStatement(businessId, query);
    const sum = statement.summary;

    const totalIncome = sum.totalIncome;
    const totalExpenses = sum.totalExpenses;
    const netProfit = sum.netProfit;

    const totalCombined = totalIncome + totalExpenses + (netProfit > 0 ? netProfit : 0);

    const donutBreakdown = [
      {
        name: "Total Income",
        amount: totalIncome,
        percentage: totalCombined > 0 ? Number(((totalIncome / totalCombined) * 100).toFixed(1)) : 50.0,
        color: "#16A34A",
      },
      {
        name: "Total Expenses",
        amount: totalExpenses,
        percentage: totalCombined > 0 ? Number(((totalExpenses / totalCombined) * 100).toFixed(1)) : 35.0,
        color: "#DC2626",
      },
      {
        name: "Net Profit",
        amount: netProfit,
        percentage: totalCombined > 0 ? Number(((netProfit / totalCombined) * 100).toFixed(1)) : 15.0,
        color: "#2563EB",
      },
    ];

    return {
      ...sum,
      donutBreakdown,
    };
  }

  /**
   * 3. Get Profit Trend Points
   */
  async getProfitTrend(
    businessId: string,
    query: FinancialStatementQueryInput
  ): Promise<{
    trendPeriod: string;
    trendPoints: ProfitTrendPointRecord[];
    latestMonth: string;
    latestProfit: number;
    highestMonth: string;
    highestProfit: number;
  }> {
    const statement = await this.getFinancialStatement(businessId, query);
    const points = statement.trendPoints;

    let highestProfit = 0;
    let highestMonth = "";

    for (const pt of points) {
      if (pt.amount > highestProfit) {
        highestProfit = pt.amount;
        highestMonth = pt.month;
      }
    }

    const latest = points[points.length - 1];

    return {
      trendPeriod: query.trendPeriod || "Last 6 Months",
      trendPoints: points,
      latestMonth: latest?.month || "May 2026",
      latestProfit: latest?.amount || 293480.0,
      highestMonth: highestMonth || "May 2026",
      highestProfit: highestProfit || 293480.0,
    };
  }

  /**
   * 4. Get available report types cards metadata
   */
  getAvailableReportTypes() {
    return [
      {
        id: "profitAndLoss",
        key: "pnl",
        title: "Profit & Loss Statement",
        subtitle: "View your income and expenses performance",
        icon: "description_outlined",
        iconBg: "#DCFCE7",
        iconColor: "#16A34A",
        btnBg: "#F0FDF4",
        btnColor: "#15803D",
      },
      {
        id: "balanceSheet",
        key: "bs",
        title: "Balance Sheet",
        subtitle: "View your assets, liabilities and equity position",
        icon: "balance_outlined",
        iconBg: "#E0F2FE",
        iconColor: "#0284C7",
        btnBg: "#F0F9FF",
        btnColor: "#0284C7",
      },
      {
        id: "cashFlow",
        key: "cf",
        title: "Cash Flow Statement",
        subtitle: "Track cash inflows and outflows",
        icon: "payments_outlined",
        iconBg: "#F3E8FF",
        iconColor: "#9333EA",
        btnBg: "#FAF5FF",
        btnColor: "#9333EA",
      },
      {
        id: "equityChanges",
        key: "eq",
        title: "Statement of Changes in Equity",
        subtitle: "View changes in equity over time",
        icon: "bar_chart_rounded",
        iconBg: "#FFEDD5",
        iconColor: "#EA580C",
        btnBg: "#FFF7ED",
        btnColor: "#EA580C",
      },
    ];
  }

  /**
   * 5. Custom report creation
   */
  async createCustomReport(businessId: string, input: CustomReportInput) {
    return this.repo.createCustomReport(businessId, input);
  }

  /**
   * 6. Schedule report
   */
  async scheduleReport(businessId: string, input: ScheduleReportInput) {
    return this.repo.scheduleReport(businessId, input);
  }

  /**
   * 7. Save layout preset
   */
  async saveLayout(businessId: string, input: SaveLayoutInput) {
    return this.repo.saveLayout(businessId, input);
  }

  /**
   * 8. Export Statement (CSV, JSON, etc.)
   */
  async exportStatement(
    businessId: string,
    query: ExportStatementQueryInput
  ): Promise<{
    filename: string;
    mimeType: string;
    content: string;
    reportType: string;
    dateRangeLabel: string;
  }> {
    const reportType = normalizeReportType(query.reportType);
    const dateRangeLabel = query.dateRangeLabel || "01 Apr 2026 – 31 May 2026";

    const statement = await this.repo.getFinancialStatement(businessId, {
      reportType,
      dateRangeLabel,
      compareWith: "Previous Period",
      trendPeriod: "Last 6 Months",
    });

    const filename = `${reportType}_statement_${Date.now()}.${query.format === "json" ? "json" : "csv"}`;

    if (query.format === "json") {
      return {
        filename,
        mimeType: "application/json",
        content: JSON.stringify(statement, null, 2),
        reportType,
        dateRangeLabel,
      };
    }

    // CSV format
    const rows: string[] = [];
    rows.push(`"TAX BUNNY RETAIL STORE - ${statement.reportTypeLabel.toUpperCase()}"`);
    rows.push(`"Period: ${statement.dateRangeLabel}"`);
    rows.push(`"Currency: INR"`);
    rows.push("");
    rows.push(`"Section","Particulars","Current Period (₹)","Previous Period (₹)","% Change"`);

    for (const sec of statement.sections) {
      rows.push(`"--- ${sec.sectionTitle} ---","","","",""`);
      for (const it of sec.items) {
        rows.push(
          `"${sec.sectionTitle}","${it.label}","${it.currentAmount}","${it.previousAmount}","${it.percentChange > 0 ? "+" : ""}${it.percentChange.toFixed(2)}%"`
        );
      }
      rows.push(
        `"${sec.sectionTitle}","${sec.totalItem.label}","${sec.totalItem.currentAmount}","${sec.totalItem.previousAmount}","${sec.totalItem.percentChange > 0 ? "+" : ""}${sec.totalItem.percentChange.toFixed(2)}%"`
      );
      rows.push("");
    }

    if (statement.bannerItem) {
      rows.push(
        `"SUMMARY","${statement.bannerItem.label}","${statement.bannerItem.currentAmount}","${statement.bannerItem.previousAmount}","${statement.bannerItem.percentChange > 0 ? "+" : ""}${statement.bannerItem.percentChange.toFixed(2)}%"`
      );
    }

    return {
      filename,
      mimeType: "text/csv",
      content: rows.join("\n"),
      reportType,
      dateRangeLabel,
    };
  }
}

export const financialStatementsService = new FinancialStatementsService();
