import { prisma } from "../../../../db/prisma";
import type {
  CustomReportInput,
  SaveLayoutInput,
  ScheduleReportInput,
} from "../validators/financial-statements.validators";

export interface StatementLineItemRecord {
  label: string;
  currentAmount: number;
  previousAmount: number;
  percentChange: number;
  isPositive: boolean;
  isHeader: boolean;
  isTotal: boolean;
  isHighlight: boolean;
  accountCode?: string;
  category?: string;
}

export interface ProfitTrendPointRecord {
  month: string;
  amount: number;
  label: string;
}

export interface StatementSectionRecord {
  sectionTitle: string;
  sectionColor: string;
  items: StatementLineItemRecord[];
  totalItem: StatementLineItemRecord;
}

export interface FinancialStatementSummaryRecord {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  netProfitMargin: number;
  profitGrowthPercent: number;
  incomeItems: StatementLineItemRecord[];
  totalIncomeItem: StatementLineItemRecord;
  expenseItems: StatementLineItemRecord[];
  totalExpenseItem: StatementLineItemRecord;
  netProfitItem: StatementLineItemRecord;
  trendPoints: ProfitTrendPointRecord[];
}

export interface FinancialStatementRecord {
  reportType: "profitAndLoss" | "balanceSheet" | "cashFlow" | "equityChanges";
  reportTypeLabel: string;
  dateRangeLabel: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  compareWith: string;
  sections: StatementSectionRecord[];
  bannerItem?: StatementLineItemRecord;
  summary: FinancialStatementSummaryRecord;
  trendPeriod: string;
  trendPoints: ProfitTrendPointRecord[];
  currency: string;
  companyName: string;
}

export interface ScheduledReportRecord {
  id: string;
  businessId: string;
  reportType: string;
  frequency: string;
  recipients: string[];
  format: string;
  createdAt: Date;
}

export interface SavedLayoutRecord {
  id: string;
  businessId: string;
  reportType: string;
  layoutName: string;
  compareWith: string;
  trendPeriod: string;
  visibleSections: string[];
  createdAt: Date;
}

export interface CustomReportRecord {
  id: string;
  businessId: string;
  reportName: string;
  reportType: string;
  startDate?: string;
  endDate?: string;
  sections: string[];
  createdAt: Date;
}

export class FinancialStatementsRepo {
  private scheduledReportsStore: Map<string, ScheduledReportRecord[]> = new Map();
  private savedLayoutsStore: Map<string, SavedLayoutRecord[]> = new Map();
  private customReportsStore: Map<string, CustomReportRecord[]> = new Map();

  /**
   * P&L Seed Dataset matching Flutter UI screen exactly
   */
  private getPnlStatement(): {
    sections: StatementSectionRecord[];
    bannerItem: StatementLineItemRecord;
    summary: FinancialStatementSummaryRecord;
  } {
    const incomeItems: StatementLineItemRecord[] = [
      {
        label: "Sales Revenue",
        currentAmount: 1275430.0,
        previousAmount: 1025300.0,
        percentChange: 24.42,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "4001",
      },
      {
        label: "Other Income",
        currentAmount: 25000.0,
        previousAmount: 18500.0,
        percentChange: 35.14,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "4002",
      },
    ];

    const totalIncomeItem: StatementLineItemRecord = {
      label: "Total Income",
      currentAmount: 1300430.0,
      previousAmount: 1043800.0,
      percentChange: 24.61,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const expenseItems: StatementLineItemRecord[] = [
      {
        label: "Cost of Goods Sold",
        currentAmount: 625300.0,
        previousAmount: 510200.0,
        percentChange: 22.55,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "5001",
      },
      {
        label: "Operating Expenses",
        currentAmount: 320450.0,
        previousAmount: 275300.0,
        percentChange: 16.39,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "5002",
      },
      {
        label: "Administrative Expenses",
        currentAmount: 115200.0,
        previousAmount: 95400.0,
        percentChange: 20.78,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "5003",
      },
      {
        label: "Other Expenses",
        currentAmount: 45000.0,
        previousAmount: 35250.0,
        percentChange: 27.66,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "5004",
      },
    ];

    const totalExpenseItem: StatementLineItemRecord = {
      label: "Total Expenses",
      currentAmount: 1006950.0,
      previousAmount: 816150.0,
      percentChange: 23.38,
      isPositive: false,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const netProfitItem: StatementLineItemRecord = {
      label: "Net Profit",
      currentAmount: 293480.0,
      previousAmount: 227650.0,
      percentChange: 28.91,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: true,
    };

    const trendPoints: ProfitTrendPointRecord[] = [
      { month: "Dec 2025", amount: 110000.0, label: "₹1.1L" },
      { month: "Jan 2026", amount: 185000.0, label: "₹1.85L" },
      { month: "Feb 2026", amount: 170000.0, label: "₹1.7L" },
      { month: "Mar 2026", amount: 280000.0, label: "₹2.8L" },
      { month: "Apr 2026", amount: 172000.0, label: "₹1.72L" },
      { month: "May 2026", amount: 293480.0, label: "₹2.93L" },
    ];

    const sections: StatementSectionRecord[] = [
      {
        sectionTitle: "INCOME",
        sectionColor: "#15803D",
        items: incomeItems,
        totalItem: totalIncomeItem,
      },
      {
        sectionTitle: "EXPENSES",
        sectionColor: "#DC2626",
        items: expenseItems,
        totalItem: totalExpenseItem,
      },
    ];

    const summary: FinancialStatementSummaryRecord = {
      totalIncome: 1300430.0,
      totalExpenses: 1006950.0,
      netProfit: 293480.0,
      netProfitMargin: 22.56,
      profitGrowthPercent: 28.91,
      incomeItems,
      totalIncomeItem,
      expenseItems,
      totalExpenseItem,
      netProfitItem,
      trendPoints,
    };

    return { sections, bannerItem: netProfitItem, summary };
  }

  /**
   * Balance Sheet Dataset
   */
  private getBalanceSheetStatement(): {
    sections: StatementSectionRecord[];
    bannerItem: StatementLineItemRecord;
    summary: FinancialStatementSummaryRecord;
  } {
    const currentAssetItems: StatementLineItemRecord[] = [
      {
        label: "Cash and Bank Balances",
        currentAmount: 1875430.5,
        previousAmount: 1420100.0,
        percentChange: 32.06,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1001",
      },
      {
        label: "Accounts Receivable",
        currentAmount: 426500.0,
        previousAmount: 385000.0,
        percentChange: 10.78,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1002",
      },
      {
        label: "Inventory Assets",
        currentAmount: 635400.0,
        previousAmount: 580000.0,
        percentChange: 9.55,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1003",
      },
      {
        label: "Prepaid Expenses & Advances",
        currentAmount: 45000.0,
        previousAmount: 40000.0,
        percentChange: 12.5,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1004",
      },
    ];

    const totalCurrentAssets: StatementLineItemRecord = {
      label: "Total Current Assets",
      currentAmount: 2982330.5,
      previousAmount: 2425100.0,
      percentChange: 22.98,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const nonCurrentAssetItems: StatementLineItemRecord[] = [
      {
        label: "Property, Plant & Equipment",
        currentAmount: 1250000.0,
        previousAmount: 1100000.0,
        percentChange: 13.64,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1501",
      },
      {
        label: "Less: Accumulated Depreciation",
        currentAmount: -180000.0,
        previousAmount: -150000.0,
        percentChange: 20.0,
        isPositive: false,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "1502",
      },
    ];

    const totalNonCurrentAssets: StatementLineItemRecord = {
      label: "Total Non-Current Assets",
      currentAmount: 1070000.0,
      previousAmount: 950000.0,
      percentChange: 12.63,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const liabilityItems: StatementLineItemRecord[] = [
      {
        label: "Accounts Payable",
        currentAmount: 345200.0,
        previousAmount: 290000.0,
        percentChange: 19.03,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "2001",
      },
      {
        label: "Short-term Borrowings & OD",
        currentAmount: 215430.0,
        previousAmount: 250000.0,
        percentChange: -13.83,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "2002",
      },
      {
        label: "GST & Statutory Duties Payable",
        currentAmount: 112300.0,
        previousAmount: 95000.0,
        percentChange: 18.21,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "2003",
      },
      {
        label: "Long-term Bank Loans",
        currentAmount: 850000.0,
        previousAmount: 920000.0,
        percentChange: -7.61,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "2501",
      },
    ];

    const totalLiabilities: StatementLineItemRecord = {
      label: "Total Liabilities",
      currentAmount: 1522930.0,
      previousAmount: 1555000.0,
      percentChange: -2.06,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const equityItems: StatementLineItemRecord[] = [
      {
        label: "Owner's Capital",
        currentAmount: 2000000.0,
        previousAmount: 1500000.0,
        percentChange: 33.33,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "3001",
      },
      {
        label: "Retained Earnings & Reserves",
        currentAmount: 529400.5,
        previousAmount: 320100.0,
        percentChange: 65.39,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
        accountCode: "3002",
      },
    ];

    const totalEquity: StatementLineItemRecord = {
      label: "Total Equity",
      currentAmount: 2529400.5,
      previousAmount: 1820100.0,
      percentChange: 38.97,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const netAssetsBanner: StatementLineItemRecord = {
      label: "Total Assets = Liabilities + Equity",
      currentAmount: 4052330.5,
      previousAmount: 3375100.0,
      percentChange: 20.07,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: true,
    };

    const sections: StatementSectionRecord[] = [
      {
        sectionTitle: "CURRENT ASSETS",
        sectionColor: "#0284C7",
        items: currentAssetItems,
        totalItem: totalCurrentAssets,
      },
      {
        sectionTitle: "NON-CURRENT ASSETS",
        sectionColor: "#0369A1",
        items: nonCurrentAssetItems,
        totalItem: totalNonCurrentAssets,
      },
      {
        sectionTitle: "LIABILITIES",
        sectionColor: "#DC2626",
        items: liabilityItems,
        totalItem: totalLiabilities,
      },
      {
        sectionTitle: "EQUITY",
        sectionColor: "#15803D",
        items: equityItems,
        totalItem: totalEquity,
      },
    ];

    const summary: FinancialStatementSummaryRecord = {
      totalIncome: 4052330.5, // Total Assets
      totalExpenses: 1522930.0, // Total Liabilities
      netProfit: 2529400.5, // Total Equity / Net Assets
      netProfitMargin: 62.42,
      profitGrowthPercent: 38.97,
      incomeItems: currentAssetItems,
      totalIncomeItem: totalCurrentAssets,
      expenseItems: liabilityItems,
      totalExpenseItem: totalLiabilities,
      netProfitItem: netAssetsBanner,
      trendPoints: [
        { month: "Dec 2025", amount: 1500000.0, label: "₹15.0L" },
        { month: "Jan 2026", amount: 1720000.0, label: "₹17.2L" },
        { month: "Feb 2026", amount: 1820000.0, label: "₹18.2L" },
        { month: "Mar 2026", amount: 2100000.0, label: "₹21.0L" },
        { month: "Apr 2026", amount: 2350000.0, label: "₹23.5L" },
        { month: "May 2026", amount: 2529400.5, label: "₹25.3L" },
      ],
    };

    return { sections, bannerItem: netAssetsBanner, summary };
  }

  /**
   * Cash Flow Statement Dataset
   */
  private getCashFlowStatement(): {
    sections: StatementSectionRecord[];
    bannerItem: StatementLineItemRecord;
    summary: FinancialStatementSummaryRecord;
  } {
    const operatingItems: StatementLineItemRecord[] = [
      {
        label: "Net Profit before Tax",
        currentAmount: 293480.0,
        previousAmount: 227650.0,
        percentChange: 28.91,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Depreciation & Non-Cash Adjustments",
        currentAmount: 30000.0,
        previousAmount: 25000.0,
        percentChange: 20.0,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Change in Accounts Receivable",
        currentAmount: -41500.0,
        previousAmount: -30000.0,
        percentChange: 38.33,
        isPositive: false,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Change in Inventory",
        currentAmount: -55400.0,
        previousAmount: -45000.0,
        percentChange: 23.11,
        isPositive: false,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Change in Accounts Payable",
        currentAmount: 55200.0,
        previousAmount: 40000.0,
        percentChange: 38.0,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
    ];

    const totalOperatingItem: StatementLineItemRecord = {
      label: "Net Cash Flow from Operations",
      currentAmount: 281780.0,
      previousAmount: 217650.0,
      percentChange: 29.46,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const investingItems: StatementLineItemRecord[] = [
      {
        label: "Purchase of Equipment / Fixed Assets",
        currentAmount: -150000.0,
        previousAmount: -200000.0,
        percentChange: -25.0,
        isPositive: false,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
    ];

    const totalInvestingItem: StatementLineItemRecord = {
      label: "Net Cash used in Investing Activities",
      currentAmount: -150000.0,
      previousAmount: -200000.0,
      percentChange: -25.0,
      isPositive: false,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const financingItems: StatementLineItemRecord[] = [
      {
        label: "Capital Introduced / Equity Issued",
        currentAmount: 500000.0,
        previousAmount: 0.0,
        percentChange: 100.0,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Repayment of Loans & Borrowings",
        currentAmount: -104570.0,
        previousAmount: -50000.0,
        percentChange: 109.14,
        isPositive: false,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
    ];

    const totalFinancingItem: StatementLineItemRecord = {
      label: "Net Cash from Financing Activities",
      currentAmount: 395430.0,
      previousAmount: -50000.0,
      percentChange: 890.86,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const netCashBanner: StatementLineItemRecord = {
      label: "Closing Cash & Bank Balance",
      currentAmount: 1875430.5,
      previousAmount: 1348220.5,
      percentChange: 39.1,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: true,
    };

    const sections: StatementSectionRecord[] = [
      {
        sectionTitle: "OPERATING ACTIVITIES",
        sectionColor: "#15803D",
        items: operatingItems,
        totalItem: totalOperatingItem,
      },
      {
        sectionTitle: "INVESTING ACTIVITIES",
        sectionColor: "#DC2626",
        items: investingItems,
        totalItem: totalInvestingItem,
      },
      {
        sectionTitle: "FINANCING ACTIVITIES",
        sectionColor: "#9333EA",
        items: financingItems,
        totalItem: totalFinancingItem,
      },
    ];

    const summary: FinancialStatementSummaryRecord = {
      totalIncome: 677210.0, // Inflows
      totalExpenses: 150000.0, // Outflows
      netProfit: 527210.0, // Net increase in cash
      netProfitMargin: 77.85,
      profitGrowthPercent: 39.1,
      incomeItems: operatingItems,
      totalIncomeItem: totalOperatingItem,
      expenseItems: investingItems,
      totalExpenseItem: totalInvestingItem,
      netProfitItem: netCashBanner,
      trendPoints: [
        { month: "Dec 2025", amount: 1380570.5, label: "₹13.8L" },
        { month: "Jan 2026", amount: 1450000.0, label: "₹14.5L" },
        { month: "Feb 2026", amount: 1520000.0, label: "₹15.2L" },
        { month: "Mar 2026", amount: 1600000.0, label: "₹16.0L" },
        { month: "Apr 2026", amount: 1720000.0, label: "₹17.2L" },
        { month: "May 2026", amount: 1875430.5, label: "₹18.8L" },
      ],
    };

    return { sections, bannerItem: netCashBanner, summary };
  }

  /**
   * Statement of Changes in Equity Dataset
   */
  private getEquityChangesStatement(): {
    sections: StatementSectionRecord[];
    bannerItem: StatementLineItemRecord;
    summary: FinancialStatementSummaryRecord;
  } {
    const capitalItems: StatementLineItemRecord[] = [
      {
        label: "Opening Owner's Capital",
        currentAmount: 1500000.0,
        previousAmount: 1500000.0,
        percentChange: 0.0,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Fresh Capital Contribution",
        currentAmount: 500000.0,
        previousAmount: 0.0,
        percentChange: 100.0,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
    ];

    const totalCapitalItem: StatementLineItemRecord = {
      label: "Closing Owner's Capital",
      currentAmount: 2000000.0,
      previousAmount: 1500000.0,
      percentChange: 33.33,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const earningsItems: StatementLineItemRecord[] = [
      {
        label: "Opening Retained Earnings",
        currentAmount: 235920.5,
        previousAmount: 92450.0,
        percentChange: 155.19,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
      {
        label: "Profit / (Loss) for the Period",
        currentAmount: 293480.0,
        previousAmount: 227650.0,
        percentChange: 28.91,
        isPositive: true,
        isHeader: false,
        isTotal: false,
        isHighlight: false,
      },
    ];

    const totalEarningsItem: StatementLineItemRecord = {
      label: "Closing Retained Earnings",
      currentAmount: 529400.5,
      previousAmount: 320100.0,
      percentChange: 65.39,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: false,
    };

    const totalEquityBanner: StatementLineItemRecord = {
      label: "Total Owner's Equity at Period End",
      currentAmount: 2529400.5,
      previousAmount: 1820100.0,
      percentChange: 38.97,
      isPositive: true,
      isHeader: false,
      isTotal: true,
      isHighlight: true,
    };

    const sections: StatementSectionRecord[] = [
      {
        sectionTitle: "SHARE CAPITAL / OWNER'S EQUITY",
        sectionColor: "#EA580C",
        items: capitalItems,
        totalItem: totalCapitalItem,
      },
      {
        sectionTitle: "RETAINED EARNINGS & RESERVES",
        sectionColor: "#15803D",
        items: earningsItems,
        totalItem: totalEarningsItem,
      },
    ];

    const summary: FinancialStatementSummaryRecord = {
      totalIncome: 2529400.5,
      totalExpenses: 0.0,
      netProfit: 793480.0, // Total movement
      netProfitMargin: 31.37,
      profitGrowthPercent: 38.97,
      incomeItems: capitalItems,
      totalIncomeItem: totalCapitalItem,
      expenseItems: earningsItems,
      totalExpenseItem: totalEarningsItem,
      netProfitItem: totalEquityBanner,
      trendPoints: [
        { month: "Dec 2025", amount: 1592450.0, label: "₹15.9L" },
        { month: "Jan 2026", amount: 1720000.0, label: "₹17.2L" },
        { month: "Feb 2026", amount: 1820100.0, label: "₹18.2L" },
        { month: "Mar 2026", amount: 2100000.0, label: "₹21.0L" },
        { month: "Apr 2026", amount: 2350000.0, label: "₹23.5L" },
        { month: "May 2026", amount: 2529400.5, label: "₹25.3L" },
      ],
    };

    return { sections, bannerItem: totalEquityBanner, summary };
  }

  /**
   * Retrieves the full financial statement for a business tenant
   */
  async getFinancialStatement(
    businessId: string,
    options: {
      reportType: "profitAndLoss" | "balanceSheet" | "cashFlow" | "equityChanges";
      dateRangeLabel: string;
      compareWith: string;
      trendPeriod: string;
    }
  ): Promise<FinancialStatementRecord> {
    let companyName = "Tax Bunny Retail Store";

    // Attempt to fetch business name if business exists in prisma
    try {
      if (businessId && businessId !== "biz_default_retail") {
        const biz = await prisma.business.findUnique({
          where: { id: businessId },
          select: { businessName: true, tradeName: true },
        });
        if (biz?.businessName) {
          companyName = biz.businessName;
        } else if (biz?.tradeName) {
          companyName = biz.tradeName;
        }
      }
    } catch {
      // Prisma error fallback
    }

    let reportTypeLabel = "Profit & Loss Statement";
    let statementData: {
      sections: StatementSectionRecord[];
      bannerItem: StatementLineItemRecord;
      summary: FinancialStatementSummaryRecord;
    };

    switch (options.reportType) {
      case "balanceSheet":
        reportTypeLabel = "Balance Sheet";
        statementData = this.getBalanceSheetStatement();
        break;
      case "cashFlow":
        reportTypeLabel = "Cash Flow Statement";
        statementData = this.getCashFlowStatement();
        break;
      case "equityChanges":
        reportTypeLabel = "Statement of Changes in Equity";
        statementData = this.getEquityChangesStatement();
        break;
      case "profitAndLoss":
      default:
        reportTypeLabel = "Profit & Loss Statement";
        statementData = this.getPnlStatement();
        break;
    }

    // Determine current & previous period column labels
    const currentPeriodLabel = options.dateRangeLabel;
    let previousPeriodLabel = "01 Feb – 31 Mar 2026";
    if (options.compareWith === "Previous Year") {
      previousPeriodLabel = "01 Apr – 31 May 2025";
    } else if (options.compareWith === "None") {
      previousPeriodLabel = "-";
    }

    return {
      reportType: options.reportType,
      reportTypeLabel,
      dateRangeLabel: options.dateRangeLabel,
      currentPeriodLabel,
      previousPeriodLabel,
      compareWith: options.compareWith,
      sections: statementData.sections,
      bannerItem: statementData.bannerItem,
      summary: statementData.summary,
      trendPeriod: options.trendPeriod,
      trendPoints: statementData.summary.trendPoints,
      currency: "INR",
      companyName,
    };
  }

  /**
   * Save custom layout preset
   */
  async saveLayout(businessId: string, input: SaveLayoutInput): Promise<SavedLayoutRecord> {
    const list = this.savedLayoutsStore.get(businessId) || [];
    const newRecord: SavedLayoutRecord = {
      id: `layout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      reportType: input.reportType || "profitAndLoss",
      layoutName: input.layoutName,
      compareWith: input.compareWith || "Previous Period",
      trendPeriod: input.trendPeriod || "Last 6 Months",
      visibleSections: input.visibleSections || [],
      createdAt: new Date(),
    };
    list.push(newRecord);
    this.savedLayoutsStore.set(businessId, list);
    return newRecord;
  }

  /**
   * Schedule report delivery
   */
  async scheduleReport(businessId: string, input: ScheduleReportInput): Promise<ScheduledReportRecord> {
    const list = this.scheduledReportsStore.get(businessId) || [];
    const newRecord: ScheduledReportRecord = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      reportType: input.reportType || "profitAndLoss",
      frequency: input.frequency,
      recipients: input.recipients,
      format: input.format || "pdf",
      createdAt: new Date(),
    };
    list.push(newRecord);
    this.scheduledReportsStore.set(businessId, list);
    return newRecord;
  }

  /**
   * Create custom report configuration
   */
  async createCustomReport(businessId: string, input: CustomReportInput): Promise<CustomReportRecord> {
    const list = this.customReportsStore.get(businessId) || [];
    const newRecord: CustomReportRecord = {
      id: `custom_rpt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      reportName: input.reportName,
      reportType: input.reportType || "profitAndLoss",
      startDate: input.startDate,
      endDate: input.endDate,
      sections: input.sections || [],
      createdAt: new Date(),
    };
    list.push(newRecord);
    this.customReportsStore.set(businessId, list);
    return newRecord;
  }

  /**
   * Get saved layouts
   */
  async getSavedLayouts(businessId: string): Promise<SavedLayoutRecord[]> {
    return this.savedLayoutsStore.get(businessId) || [];
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(businessId: string): Promise<ScheduledReportRecord[]> {
    return this.scheduledReportsStore.get(businessId) || [];
  }
}

export const financialStatementsRepo = new FinancialStatementsRepo();
