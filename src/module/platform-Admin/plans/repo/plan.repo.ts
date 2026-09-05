import { prisma } from "../../../../db/prisma";
import type { Prisma } from "../../../../generated/prisma/client";
import type {
  CreatePlanInput,
  UpdatePlanInput,
} from "../validators/plan.validators";

export class PlatformPlanRepository {
  /**
   * Retrieve all active SaaS plans with subscriber count
   */
  async findAll() {
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
  async findById(id: string) {
    return prisma.plan.findUnique({
      where: { id },
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
   * Find plan by unique name
   */
  async findByName(name: string) {
    return prisma.plan.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: "insensitive",
        },
        isActive: true,
      },
    });
  }

  /**
   * Create a new SaaS plan
   */
  async create(input: CreatePlanInput) {
    // Pack extra frontend metadata (tagline, yearly price, storage, features, themeColor, isPopular) into description JSON
    const metadata = {
      tagline: input.tagline || `${input.name} SaaS Tier`,
      priceYearly: input.priceYearly ?? input.priceMonthly * 10,
      storageLimitGb: input.storageLimitGb || 25.0,
      features: input.features || [],
      isPopular: input.isPopular ?? false,
      themeColor: input.themeColor || "#4F46E5",
    };

    return prisma.plan.create({
      data: {
        name: input.name.trim(),
        description: JSON.stringify(metadata),
        price: input.priceMonthly,
        billingCycle: "MONTHLY",
        maxUsers: input.maxUsers || 10,
        maxInvoicesPerMonth: input.maxInvoicesPerMonth || 5000,
        maxWarehouses: input.name.toLowerCase() === "enterprise" ? 10 : 3,
        hasPOS: true,
        hasManufacturing: input.name.toLowerCase() === "enterprise",
        hasAdvancedReports: true,
        hasApiAccess: input.name.toLowerCase() === "enterprise",
        isActive: true,
      },
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
   * Update an existing SaaS plan
   */
  async update(id: string, input: UpdatePlanInput, currentDescription?: string | null) {
    let existingMeta: any = {};
    if (currentDescription) {
      try {
        existingMeta = JSON.parse(currentDescription);
      } catch (_) {
        existingMeta = { tagline: currentDescription };
      }
    }

    const updatedMeta = {
      ...existingMeta,
      ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
      ...(input.priceYearly !== undefined ? { priceYearly: input.priceYearly } : {}),
      ...(input.storageLimitGb !== undefined ? { storageLimitGb: input.storageLimitGb } : {}),
      ...(input.features !== undefined ? { features: input.features } : {}),
      ...(input.isPopular !== undefined ? { isPopular: input.isPopular } : {}),
      ...(input.themeColor !== undefined ? { themeColor: input.themeColor } : {}),
    };

    const data: Prisma.PlanUpdateInput = {
      description: JSON.stringify(updatedMeta),
    };

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.priceMonthly !== undefined) data.price = input.priceMonthly;
    if (input.maxUsers !== undefined) data.maxUsers = input.maxUsers;
    if (input.maxInvoicesPerMonth !== undefined) data.maxInvoicesPerMonth = input.maxInvoicesPerMonth;

    return prisma.plan.update({
      where: { id },
      data,
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
   * Soft delete a plan
   */
  async delete(id: string) {
    return prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const platformPlanRepo = new PlatformPlanRepository();
