import { getCache, setCache } from "../../../utils/redis.util";
import { dashboardRepository, DashboardRepository } from "../repo/dashboard.repo";
import type {
  DashboardCashBankSummary,
  DashboardInventorySummary,
  DashboardKpiMetrics,
  DashboardOverviewResponse,
  DashboardQueryParams,
  DashboardRecentPurchasesItem,
  DashboardRecentSalesItem,
  DashboardReminderItem,
  DashboardTrendData,
  DashboardTrendPeriod,
} from "../validators/dashboard.validators";

export class DashboardService {
  private repo: DashboardRepository;

  constructor(repo: DashboardRepository = dashboardRepository) {
    this.repo = repo;
  }

  /**
   * 1. Get Unified Full Dashboard Overview (with Redis caching)
   */
  async getOverview(
    businessId: string,
    params: Partial<DashboardQueryParams> = {}
  ): Promise<DashboardOverviewResponse> {
    const period = (params.period as DashboardTrendPeriod) || "this_year";
    const cacheKey = `dashboard:overview:${businessId}:${period}`;

    // Return from Redis cache if not explicitly refreshing
    if (!params.refresh) {
      try {
        const cached = await getCache<DashboardOverviewResponse>(cacheKey);
        if (cached) {
          return {
            ...cached,
            isCached: true,
          };
        }
      } catch (_) {}
    }

    // Parallel fetch of all dashboard cards & sections
    const [metrics, trend, cashAndBank, inventory, recentSales, recentPurchases, reminders] =
      await Promise.all([
        this.repo.getKpiMetrics(businessId),
        this.repo.getSalesPurchaseTrend(businessId, period),
        this.repo.getCashAndBankSummary(businessId),
        this.repo.getInventorySummary(businessId),
        this.repo.getRecentSales(businessId, 5),
        this.repo.getRecentPurchases(businessId, 5),
        this.repo.getReminders(businessId),
      ]);

    const response: DashboardOverviewResponse = {
      metrics,
      trend,
      cashAndBank,
      inventory,
      recentSales,
      recentPurchases,
      reminders,
      generatedAt: new Date().toISOString(),
      isCached: false,
    };

    // Store in Redis with 60 seconds TTL
    try {
      await setCache(cacheKey, response, 60);
    } catch (_) {}

    return response;
  }

  /**
   * 2. Financial KPI Metrics
   */
  async getMetrics(businessId: string): Promise<DashboardKpiMetrics> {
    return this.repo.getKpiMetrics(businessId);
  }

  /**
   * 3. Sales & Purchase Trend
   */
  async getTrends(
    businessId: string,
    period: DashboardTrendPeriod = "this_year"
  ): Promise<DashboardTrendData> {
    return this.repo.getSalesPurchaseTrend(businessId, period);
  }

  /**
   * 4. Cash & Bank Balances
   */
  async getCashBank(businessId: string): Promise<DashboardCashBankSummary> {
    return this.repo.getCashAndBankSummary(businessId);
  }

  /**
   * 5. Inventory Summary
   */
  async getInventorySummary(businessId: string): Promise<DashboardInventorySummary> {
    return this.repo.getInventorySummary(businessId);
  }

  /**
   * 6. Recent Sales
   */
  async getRecentSales(
    businessId: string,
    limit: number = 5
  ): Promise<DashboardRecentSalesItem[]> {
    return this.repo.getRecentSales(businessId, limit);
  }

  /**
   * 7. Recent Purchases
   */
  async getRecentPurchases(
    businessId: string,
    limit: number = 5
  ): Promise<DashboardRecentPurchasesItem[]> {
    return this.repo.getRecentPurchases(businessId, limit);
  }

  /**
   * 8. Reminders & Actionable Insights
   */
  async getReminders(businessId: string): Promise<DashboardReminderItem[]> {
    return this.repo.getReminders(businessId);
  }
}

export const dashboardService = new DashboardService();
