import { z } from "zod";

export const dashboardTrendPeriodEnum = z.enum([
  "this_week",
  "this_month",
  "this_quarter",
  "this_year",
]);

export type DashboardTrendPeriod = z.infer<typeof dashboardTrendPeriodEnum>;

export const dashboardQuerySchema = z.object({
  period: z
    .enum(["this_week", "this_month", "this_quarter", "this_year"])
    .optional()
    .default("this_year"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  refresh: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === "true" || val === "1"),
});

export type DashboardQueryParams = z.infer<typeof dashboardQuerySchema>;

export interface KpiMetricItem {
  title: string;
  value: number;
  formattedValue: string;
  subtitle: string;
  count: number;
  percentage: string;
  isPositive: boolean;
}

export interface DashboardKpiMetrics {
  todaysSales: KpiMetricItem;
  todaysPurchases: KpiMetricItem;
  totalReceivables: KpiMetricItem;
  totalPayables: KpiMetricItem;
}

export interface DashboardTrendSpot {
  label: string;
  monthIndex: number;
  sales: number;
  purchases: number;
}

export interface DashboardTrendData {
  period: string;
  labels: string[];
  sales: number[];
  purchases: number[];
  spots: DashboardTrendSpot[];
}

export interface BankAccountItem {
  id: string;
  name: string;
  accountNumberMasked: string;
  amount: number;
  formattedAmount: string;
  iconColor: string;
  icon: string;
  isSquare: boolean;
  category: string;
  status: string;
}

export interface DashboardCashBankSummary {
  totalBalance: number;
  formattedTotalBalance: string;
  accounts: BankAccountItem[];
}

export interface DashboardInventorySummary {
  totalItems: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValuation: number;
  formattedTotalValuation: string;
}

export interface DashboardRecentSalesItem {
  id: string;
  invoiceNumber: string;
  date: string;
  rawDate: Date;
  customerName: string;
  amount: number;
  formattedAmount: string;
  status: string;
  isPaid: boolean;
}

export interface DashboardRecentPurchasesItem {
  id: string;
  purchaseNumber: string;
  date: string;
  rawDate: Date;
  supplierName: string;
  amount: number;
  formattedAmount: string;
  status: string;
  isReceived: boolean;
}

export interface DashboardReminderItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  route: string;
  count: number;
  priority: "low" | "medium" | "high";
}

export interface DashboardOverviewResponse {
  metrics: DashboardKpiMetrics;
  trend: DashboardTrendData;
  cashAndBank: DashboardCashBankSummary;
  inventory: DashboardInventorySummary;
  recentSales: DashboardRecentSalesItem[];
  recentPurchases: DashboardRecentPurchasesItem[];
  reminders: DashboardReminderItem[];
  generatedAt: string;
  isCached?: boolean;
}
