import { ErrorResponse } from "../../../utils/response.util";
import {
  SubscriptionRepository,
  subscriptionRepo,
} from "../repo/subscription.repo";
import type { SubscribePlanInput } from "../validators/subscription.validators";
import type { BillingCycle } from "../../../generated/prisma/client";

export interface PlanDTO {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxInvoicesPerMonth: number;
  storageLimitGb: number;
  features: string[];
  isPopular: boolean;
  themeColor: string;
  hasPOS: boolean;
  hasManufacturing: boolean;
  hasAdvancedReports: boolean;
  hasApiAccess: boolean;
}

export class SubscriptionService {
  private repo: SubscriptionRepository;

  constructor(repo: SubscriptionRepository = subscriptionRepo) {
    this.repo = repo;
  }

  /**
   * Helper to map DB plan to normalized DTO
   */
  mapToPlanDTO(plan: any): PlanDTO {
    let metadata: any = {};
    if (plan.description) {
      try {
        metadata = JSON.parse(plan.description);
      } catch (_) {
        metadata = { tagline: plan.description };
      }
    }

    const priceMonthly = Number(plan.price || 0);
    const priceYearly =
      metadata.priceYearly !== undefined
        ? Number(metadata.priceYearly)
        : priceMonthly * 10;

    let defaultThemeColor = "#2563EB";
    if (plan.name.toLowerCase() === "growth") defaultThemeColor = "#15803D";
    if (plan.name.toLowerCase() === "enterprise") defaultThemeColor = "#6D28D9";

    const features: string[] =
      Array.isArray(metadata.features) && metadata.features.length > 0
        ? metadata.features
        : [
            `Up to ${plan.maxUsers || 10} Team Members`,
            `${(plan.maxInvoicesPerMonth || 5000).toLocaleString()} Invoices / Month`,
            "Inventory & Barcode Scanning",
            "GST Returns & Filing Assistance",
            `${metadata.storageLimitGb || 25} GB Cloud Storage`,
          ];

    return {
      id: plan.id,
      name: plan.name,
      tagline:
        metadata.tagline ||
        `Comprehensive ${plan.name} ERP plan tailored for growing businesses.`,
      priceMonthly,
      priceYearly,
      maxUsers: plan.maxUsers || 10,
      maxInvoicesPerMonth: plan.maxInvoicesPerMonth || 5000,
      storageLimitGb: Number(metadata.storageLimitGb || 25.0),
      features,
      isPopular: Boolean(
        metadata.isPopular ?? plan.name.toLowerCase() === "growth"
      ),
      themeColor: metadata.themeColor || defaultThemeColor,
      hasPOS: Boolean(plan.hasPOS),
      hasManufacturing: Boolean(plan.hasManufacturing),
      hasAdvancedReports: Boolean(plan.hasAdvancedReports),
      hasApiAccess: Boolean(plan.hasApiAccess),
    };
  }

  /**
   * Retrieve all active SaaS plans
   */
  async getAvailablePlans(): Promise<PlanDTO[]> {
    const plans = await this.repo.findActivePlans();
    return plans.map((p) => this.mapToPlanDTO(p));
  }

  /**
   * Retrieve active subscription for the current business
   */
  async getActiveSubscription(businessId: string) {
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const sub = await this.repo.findActiveSubscription(businessId);
    if (!sub) {
      return null;
    }

    const planDto = this.mapToPlanDTO(sub.plan);

    return {
      id: sub.id,
      businessId: sub.businessId,
      status: sub.status,
      billingCycle: sub.billingCycle,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelledAt: sub.cancelledAt,
      autoRenew: sub.autoRenew,
      plan: planDto,
      invoices: sub.invoices.map((inv) => ({
        id: inv.id,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        paymentGateway: inv.paymentGateway,
        gatewayPaymentId: inv.gatewayPaymentId,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
      })),
    };
  }

  /**
   * Purchase / change plan for a business
   */
  async purchasePlan(businessId: string, input: SubscribePlanInput) {
    if (!businessId) {
      throw new ErrorResponse("Business context is required", 400);
    }

    const plan = await this.repo.findPlanById(input.planId);
    if (!plan || !plan.isActive) {
      throw new ErrorResponse("Selected plan does not exist or is inactive", 404);
    }

    const planDto = this.mapToPlanDTO(plan);
    const billingCycle = input.billingCycle as BillingCycle;
    const amount =
      billingCycle === "YEARLY" ? planDto.priceYearly : planDto.priceMonthly;

    const result = await this.repo.subscribeBusinessToPlan({
      businessId,
      planId: plan.id,
      billingCycle,
      amount,
      paymentGateway: input.paymentGateway,
      gatewayPaymentId: input.gatewayPaymentId,
    });

    return {
      message: `Successfully subscribed to ${plan.name} plan (${billingCycle.toLowerCase()})!`,
      subscription: {
        id: result.subscription.id,
        businessId: result.subscription.businessId,
        status: result.subscription.status,
        billingCycle: result.subscription.billingCycle,
        currentPeriodStart: result.subscription.currentPeriodStart,
        currentPeriodEnd: result.subscription.currentPeriodEnd,
        plan: this.mapToPlanDTO(result.subscription.plan),
      },
      invoice: {
        id: result.invoice.id,
        amount: Number(result.invoice.amount),
        currency: result.invoice.currency,
        status: result.invoice.status,
        paidAt: result.invoice.paidAt,
        gatewayPaymentId: result.invoice.gatewayPaymentId,
      },
    };
  }
}

export const subscriptionService = new SubscriptionService();
