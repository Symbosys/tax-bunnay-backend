import { prisma } from "../../../db/prisma";
import type { BillingCycle } from "../../../generated/prisma/client";

export class SubscriptionRepository {
  /**
   * Retrieve all active SaaS plans published by Platform Admin
   */
  async findActivePlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
      include: {
        _count: {
          select: {
            subscriptions: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });
  }

  /**
   * Find plan by ID
   */
  async findPlanById(id: string) {
    return prisma.plan.findUnique({
      where: { id },
    });
  }

  /**
   * Find current active subscription for a business
   */
  async findActiveSubscription(businessId: string) {
    return prisma.subscription.findUnique({
      where: { businessId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
  }

  /**
   * Atomically purchase / upgrade subscription for a business
   */
  async subscribeBusinessToPlan(params: {
    businessId: string;
    planId: string;
    billingCycle: BillingCycle;
    amount: number;
    paymentGateway?: string;
    gatewayPaymentId?: string;
  }) {
    const now = new Date();
    const periodStart = now;

    // Period calculation: 30 days for MONTHLY, 365 days for YEARLY
    const daysToAdd = params.billingCycle === "YEARLY" ? 365 : 30;
    const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      // 1. Upsert subscription
      const subscription = await tx.subscription.upsert({
        where: { businessId: params.businessId },
        update: {
          planId: params.planId,
          status: "ACTIVE",
          billingCycle: params.billingCycle,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
          autoRenew: true,
        },
        create: {
          businessId: params.businessId,
          planId: params.planId,
          status: "ACTIVE",
          billingCycle: params.billingCycle,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          autoRenew: true,
        },
        include: {
          plan: true,
        },
      });

      // 2. Record billing receipt/invoice
      const invoice = await tx.subscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          amount: params.amount,
          currency: "INR",
          status: "PAID",
          periodStart,
          periodEnd,
          paymentGateway: params.paymentGateway || "OFFLINE_CHECKOUT",
          gatewayPaymentId:
            params.gatewayPaymentId || `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          paidAt: now,
        },
      });

      return {
        subscription,
        invoice,
      };
    });
  }
}

export const subscriptionRepo = new SubscriptionRepository();
