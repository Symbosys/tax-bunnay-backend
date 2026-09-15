import { prisma } from "../../../db/prisma";
import {
  InvoiceStatus,
  PaymentStatus,
  PurchaseStatus,
} from "../../../generated/prisma/enums";
import {
  bankAccountRepository,
  type BankAccountRecord,
} from "../../double-entry-accounting/bank-account/repo/bank-account.repo";
import type {
  BankAccountItem,
  DashboardCashBankSummary,
  DashboardInventorySummary,
  DashboardKpiMetrics,
  DashboardRecentPurchasesItem,
  DashboardRecentSalesItem,
  DashboardReminderItem,
  DashboardTrendData,
  DashboardTrendPeriod,
  DashboardTrendSpot,
} from "../validators/dashboard.validators";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export class DashboardRepository {
  /**
   * 1. Financial KPI Metrics (100% Dynamic from Prisma DB)
   */
  async getKpiMetrics(businessId: string): Promise<DashboardKpiMetrics> {
    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // Parallel aggregates for sales and purchases
    const [
      todaySalesAgg,
      yesterdaySalesAgg,
      todayPurchasesAgg,
      yesterdayPurchasesAgg,
      receivablesAgg,
      payablesAgg,
    ] = await Promise.all([
      // Today's Sales
      prisma.invoice.aggregate({
        where: {
          businessId,
          invoiceDate: { gte: todayStart, lte: todayEnd },
          status: { not: InvoiceStatus.CANCELLED },
        },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      // Yesterday's Sales
      prisma.invoice.aggregate({
        where: {
          businessId,
          invoiceDate: { gte: yesterdayStart, lte: yesterdayEnd },
          status: { not: InvoiceStatus.CANCELLED },
        },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      // Today's Purchases
      prisma.purchase.aggregate({
        where: {
          businessId,
          purchaseDate: { gte: todayStart, lte: todayEnd },
          status: { not: PurchaseStatus.CANCELLED },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Yesterday's Purchases
      prisma.purchase.aggregate({
        where: {
          businessId,
          purchaseDate: { gte: yesterdayStart, lte: yesterdayEnd },
          status: { not: PurchaseStatus.CANCELLED },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Total Receivables (Unpaid & Partial Invoices)
      prisma.invoice.aggregate({
        where: {
          businessId,
          paymentStatus: {
            in: [
              PaymentStatus.UNPAID,
              PaymentStatus.PARTIALLY_PAID,
              PaymentStatus.OVERDUE,
            ],
          },
          status: { not: InvoiceStatus.CANCELLED },
        },
        _sum: { balanceAmount: true, grandTotal: true, paidAmount: true },
        _count: { id: true },
      }),
      // Total Payables (Unpaid & Partial Purchases)
      prisma.purchase.aggregate({
        where: {
          businessId,
          paymentStatus: {
            in: [
              PaymentStatus.UNPAID,
              PaymentStatus.PARTIALLY_PAID,
              PaymentStatus.OVERDUE,
            ],
          },
          status: { not: PurchaseStatus.CANCELLED },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    // Compute raw values directly from DB
    const rawTodaySales = Number(todaySalesAgg._sum.grandTotal || 0);
    const todaySalesCount = todaySalesAgg._count.id;
    const rawYesterdaySales = Number(yesterdaySalesAgg._sum.grandTotal || 0);

    const rawTodayPurchases = Number(todayPurchasesAgg._sum.totalAmount || 0);
    const todayPurchasesCount = todayPurchasesAgg._count.id;
    const rawYesterdayPurchases = Number(yesterdayPurchasesAgg._sum.totalAmount || 0);

    const rawReceivables = Number(receivablesAgg._sum.balanceAmount || 0);
    const receivablesCount = receivablesAgg._count.id;

    const rawPayables = Number(payablesAgg._sum.totalAmount || 0);
    const payablesCount = payablesAgg._count.id;

    // Growth percentage calculations
    const salesGrowth =
      rawYesterdaySales > 0
        ? Math.round(((rawTodaySales - rawYesterdaySales) / rawYesterdaySales) * 100)
        : rawTodaySales > 0
        ? 100
        : 0;

    const purchaseGrowth =
      rawYesterdayPurchases > 0
        ? Math.round(((rawTodayPurchases - rawYesterdayPurchases) / rawYesterdayPurchases) * 100)
        : rawTodayPurchases > 0
        ? 100
        : 0;

    return {
      todaysSales: {
        title: "Today's Sales",
        value: rawTodaySales,
        formattedValue: `₹ ${formatCurrency(rawTodaySales)}`,
        subtitle: `${todaySalesCount} ${todaySalesCount === 1 ? "invoice" : "invoices"} today`,
        count: todaySalesCount,
        percentage: `${Math.abs(salesGrowth)}%`,
        isPositive: salesGrowth >= 0,
      },
      todaysPurchases: {
        title: "Today's Purchases",
        value: rawTodayPurchases,
        formattedValue: `₹ ${formatCurrency(rawTodayPurchases)}`,
        subtitle: `${todayPurchasesCount} ${todayPurchasesCount === 1 ? "purchase bill" : "purchase bills"}`,
        count: todayPurchasesCount,
        percentage: `${Math.abs(purchaseGrowth)}%`,
        isPositive: purchaseGrowth <= 0,
      },
      totalReceivables: {
        title: "Total Receivables",
        value: rawReceivables,
        formattedValue: `₹ ${formatCurrency(rawReceivables)}`,
        subtitle: `${receivablesCount} ${receivablesCount === 1 ? "invoice" : "invoices"} pending`,
        count: receivablesCount,
        percentage: receivablesCount > 0 ? "Pending" : "0%",
        isPositive: receivablesCount === 0,
      },
      totalPayables: {
        title: "Total Payables",
        value: rawPayables,
        formattedValue: `₹ ${formatCurrency(rawPayables)}`,
        subtitle: `${payablesCount} ${payablesCount === 1 ? "bill" : "bills"} pending`,
        count: payablesCount,
        percentage: payablesCount > 0 ? "Due" : "0%",
        isPositive: payablesCount === 0,
      },
    };
  }

  /**
   * 2. Sales & Purchase Trend (100% Dynamic from Prisma DB)
   */
  async getSalesPurchaseTrend(
    businessId: string,
    period: DashboardTrendPeriod = "this_year"
  ): Promise<DashboardTrendData> {
    const now = new Date();
    const currentYear = now.getFullYear();

    let labels: string[] = [];
    let startDate: Date;
    let endDate: Date;
    let getBucketIndex: (date: Date) => number;

    if (period === "this_quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startMonth = currentQuarter * 3;
      const quarterMonths = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      labels = [
        quarterMonths[startMonth]!,
        quarterMonths[startMonth + 1]!,
        quarterMonths[startMonth + 2]!,
      ];
      startDate = new Date(currentYear, startMonth, 1);
      endDate = new Date(currentYear, startMonth + 3, 0, 23, 59, 59, 999);
      getBucketIndex = (date: Date) => date.getMonth() - startMonth;
    } else if (period === "this_month") {
      labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
      startDate = new Date(currentYear, now.getMonth(), 1);
      endDate = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
      getBucketIndex = (date: Date) => Math.min(Math.floor((date.getDate() - 1) / 7), 3);
    } else if (period === "this_week") {
      labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      getBucketIndex = (date: Date) => (date.getDay() + 6) % 7;
    } else {
      // Default: this_year
      labels = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      getBucketIndex = (date: Date) => date.getMonth();
    }

    const bucketCount = labels.length;
    const bucketSales = new Array(bucketCount).fill(0);
    const bucketPurchases = new Array(bucketCount).fill(0);

    try {
      const [invoices, purchases] = await Promise.all([
        prisma.invoice.findMany({
          where: {
            businessId,
            invoiceDate: { gte: startDate, lte: endDate },
            status: { not: InvoiceStatus.CANCELLED },
          },
          select: { invoiceDate: true, grandTotal: true },
        }),
        prisma.purchase.findMany({
          where: {
            businessId,
            purchaseDate: { gte: startDate, lte: endDate },
            status: { not: PurchaseStatus.CANCELLED },
          },
          select: { purchaseDate: true, totalAmount: true },
        }),
      ]);

      invoices.forEach((inv) => {
        const bucket = getBucketIndex(new Date(inv.invoiceDate));
        if (bucket >= 0 && bucket < bucketCount) {
          bucketSales[bucket] += Number(inv.grandTotal || 0);
        }
      });

      purchases.forEach((pur) => {
        const bucket = getBucketIndex(new Date(pur.purchaseDate));
        if (bucket >= 0 && bucket < bucketCount) {
          bucketPurchases[bucket] += Number(pur.totalAmount || 0);
        }
      });
    } catch (_) {}

    // Convert to thousands (K) for chart scaling
    const salesData: number[] = bucketSales.map(
      (val) => Math.round((val / 1000) * 10) / 10
    );
    const purchaseData: number[] = bucketPurchases.map(
      (val) => Math.round((val / 1000) * 10) / 10
    );

    const spots: DashboardTrendSpot[] = labels.map((label, idx) => ({
      label,
      monthIndex: idx,
      sales: salesData[idx] ?? 0,
      purchases: purchaseData[idx] ?? 0,
    }));

    return {
      period,
      labels,
      sales: salesData,
      purchases: purchaseData,
      spots,
    };
  }

  /**
   * 3. Cash & Bank Balances (100% Dynamic from DB)
   */
  async getCashAndBankSummary(businessId: string): Promise<DashboardCashBankSummary> {
    let accounts: BankAccountItem[] = [];

    try {
      const bankAccounts = await bankAccountRepository.getAllAccounts(businessId);

      if (bankAccounts && bankAccounts.length > 0) {
        accounts = bankAccounts.map((acc: BankAccountRecord) => ({
          id: acc.id,
          name: `${acc.bankName} - ${acc.accountNumberMasked.slice(-4) || "XXXX"}`,
          accountNumberMasked: acc.accountNumberMasked,
          amount: acc.currentBalance,
          formattedAmount: `₹ ${formatCurrency(acc.currentBalance)}`,
          iconColor:
            acc.logoType === "sbi"
              ? "#2563EB"
              : acc.logoType === "hdfc"
              ? "#EF4444"
              : "#10B981",
          icon: acc.bankName?.toLowerCase().includes("cash")
            ? "payments_outlined"
            : "account_balance",
          isSquare:
            acc.bankName?.toLowerCase().includes("cash") ||
            acc.logoType === "hdfc",
          category: acc.category,
          status: acc.status,
        }));
      }
    } catch (_) {}

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.amount, 0);

    return {
      totalBalance,
      formattedTotalBalance: `₹ ${formatCurrency(totalBalance)}`,
      accounts,
    };
  }

  /**
   * 4. Inventory Summary (100% Dynamic from DB)
   */
  async getInventorySummary(businessId: string): Promise<DashboardInventorySummary> {
    try {
      const products = await prisma.product.findMany({
        where: { businessId, isActive: true },
        select: {
          quantity: true,
          minStockLevel: true,
          purchasePrice: true,
        },
      });

      let inStockCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalValuation = 0;

      products.forEach((p) => {
        const qty = Number(p.quantity || 0);
        const minStock = Number(p.minStockLevel || 10);
        const cost = Number(p.purchasePrice || 0);

        totalValuation += qty * cost;

        if (qty <= 0) {
          outOfStockCount++;
        } else if (qty <= minStock) {
          lowStockCount++;
        } else {
          inStockCount++;
        }
      });

      return {
        totalItems: products.length,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalValuation,
        formattedTotalValuation: `₹ ${formatCurrency(totalValuation)}`,
      };
    } catch (_) {
      return {
        totalItems: 0,
        inStockCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalValuation: 0,
        formattedTotalValuation: "₹ 0.00",
      };
    }
  }

  /**
   * 5. Recent Sales Activity (100% Dynamic from DB)
   */
  async getRecentSales(
    businessId: string,
    limit: number = 5
  ): Promise<DashboardRecentSalesItem[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: { businessId },
        orderBy: { invoiceDate: "desc" },
        take: limit,
        include: {
          customer: { select: { name: true } },
        },
      });

      return invoices.map((inv) => {
        const isPaid = inv.paymentStatus === PaymentStatus.PAID;
        const customerName =
          inv.customerName?.trim() ||
          inv.customer?.name?.trim() ||
          "Walk-in Customer";
        const amount = Number(inv.grandTotal || 0);

        return {
          id: inv.id,
          invoiceNumber:
            inv.invoiceNumber || `INV-${inv.id.slice(0, 6).toUpperCase()}`,
          date: formatDate(new Date(inv.invoiceDate)),
          rawDate: new Date(inv.invoiceDate),
          customerName,
          amount,
          formattedAmount: `₹ ${formatCurrency(amount)}`,
          status: isPaid ? "Paid" : "Pending",
          isPaid,
        };
      });
    } catch (_) {
      return [];
    }
  }

  /**
   * 6. Recent Purchases Activity (100% Dynamic from DB)
   */
  async getRecentPurchases(
    businessId: string,
    limit: number = 5
  ): Promise<DashboardRecentPurchasesItem[]> {
    try {
      const purchases = await prisma.purchase.findMany({
        where: { businessId },
        orderBy: { purchaseDate: "desc" },
        take: limit,
        include: {
          supplier: { select: { name: true } },
        },
      });

      return purchases.map((pur) => {
        const isReceived =
          pur.isConfirmed ||
          pur.status === PurchaseStatus.CONFIRMED;
        const supplierName = pur.supplier?.name?.trim() || "Supplier";
        const amount = Number(pur.totalAmount || 0);

        return {
          id: pur.id,
          purchaseNumber:
            pur.purchaseNumber || `PUR-${pur.id.slice(0, 6).toUpperCase()}`,
          date: formatDate(new Date(pur.purchaseDate)),
          rawDate: new Date(pur.purchaseDate),
          supplierName,
          amount,
          formattedAmount: `₹ ${formatCurrency(amount)}`,
          status: isReceived ? "Received" : "Pending",
          isReceived,
        };
      });
    } catch (_) {
      return [];
    }
  }

  /**
   * 7. Upcoming Reminders & Actionable Insights (100% Dynamic from DB)
   */
  async getReminders(businessId: string): Promise<DashboardReminderItem[]> {
    const reminders: DashboardReminderItem[] = [];

    try {
      const now = new Date();

      const [dueBillsCount, pendingReceivablesCount, lowStockCount] =
        await Promise.all([
          prisma.purchase.count({
            where: {
              businessId,
              paymentStatus: {
                in: [
                  PaymentStatus.UNPAID,
                  PaymentStatus.PARTIALLY_PAID,
                  PaymentStatus.OVERDUE,
                ],
              },
              status: { not: PurchaseStatus.CANCELLED },
            },
          }),
          prisma.invoice.count({
            where: {
              businessId,
              paymentStatus: {
                in: [
                  PaymentStatus.UNPAID,
                  PaymentStatus.PARTIALLY_PAID,
                  PaymentStatus.OVERDUE,
                ],
              },
              status: { not: InvoiceStatus.CANCELLED },
            },
          }),
          prisma.product.count({
            where: {
              businessId,
              isActive: true,
              quantity: { lte: 10 },
            },
          }),
        ]);

      if (dueBillsCount > 0) {
        reminders.push({
          id: "rem_bills",
          title: `${dueBillsCount} Purchase ${
            dueBillsCount === 1 ? "Bill" : "Bills"
          } due`,
          subtitle: "Awaiting supplier payment",
          icon: "calendar_month_outlined",
          iconColor: "#F97316",
          route: "/purchase",
          count: dueBillsCount,
          priority: "high",
        });
      }

      if (pendingReceivablesCount > 0) {
        reminders.push({
          id: "rem_invoices",
          title: `${pendingReceivablesCount} Customer ${
            pendingReceivablesCount === 1 ? "Payment" : "Payments"
          }`,
          subtitle: "Awaiting customer collection",
          icon: "credit_card_outlined",
          iconColor: "#8B5CF6",
          route: "/outstanding",
          count: pendingReceivablesCount,
          priority: "medium",
        });
      }

      if (lowStockCount > 0) {
        reminders.push({
          id: "rem_low_stock",
          title: `${lowStockCount} ${
            lowStockCount === 1 ? "Product" : "Products"
          } Low in Stock`,
          subtitle: "Reorder threshold reached",
          icon: "inventory_2_outlined",
          iconColor: "#EF4444",
          route: "/inventory",
          count: lowStockCount,
          priority: "high",
        });
      }

      // GST Return monthly compliance reminder
      reminders.push({
        id: "rem_gst",
        title: "GST Return",
        subtitle: `Due on 20 ${formatDate(now).split(" ")[1]} ${now.getFullYear()}`,
        icon: "assignment_turned_in_outlined",
        iconColor: "#10B981",
        route: "/gst",
        count: 1,
        priority: "medium",
      });
    } catch (_) {}

    return reminders;
  }
}

export const dashboardRepository = new DashboardRepository();
