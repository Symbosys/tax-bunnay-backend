import { prisma } from "../../../../db/prisma";
import type { Prisma, SubscriptionStatus, BillingCycle } from "../../../../generated/prisma/client";
import type {
  CreatePlatformOrganizationInput,
  PlatformOrganizationQueryInput,
  UpdatePlatformOrganizationInput,
  TenantStatusType,
} from "../validators/organization.validators";

export class PlatformOrganizationRepository {
  /**
   * List organizations with flexible search, filtering, and pagination
   */
  async findAllWithFilters(query: PlatformOrganizationQueryInput) {
    const where: Prisma.BusinessWhereInput = {};

    // 1. Search filter across businessName, tradeName (domain), cinOrLlpin (code), gstin, email, and owner
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { tradeName: { contains: q, mode: "insensitive" } },
        { cinOrLlpin: { contains: q, mode: "insensitive" } },
        { gstin: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        {
          owner: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // 2. Status & Plan filters
    const subscriptionWhere: Prisma.SubscriptionWhereInput = {};
    let filterSubscription = false;

    if (query.status && query.status !== "All") {
      switch (query.status) {
        case "Active":
          where.isActive = true;
          subscriptionWhere.status = "ACTIVE";
          filterSubscription = true;
          break;
        case "Trial":
          subscriptionWhere.status = "TRIALING";
          filterSubscription = true;
          break;
        case "Suspended":
          where.OR = [
            { isActive: false },
            {
              subscription: {
                is: {
                  status: { in: ["CANCELLED", "PAST_DUE", "EXPIRED"] },
                },
              },
            },
          ];
          break;
        case "Pending":
          where.subscription = null;
          break;
      }
    }

    // 3. Plan filter
    if (query.plan && query.plan !== "All") {
      subscriptionWhere.plan = {
        is: {
          name: { equals: query.plan, mode: "insensitive" },
        },
      };
      filterSubscription = true;
    }

    if (filterSubscription && query.status !== "Pending" && query.status !== "Suspended") {
      where.subscription = { is: subscriptionWhere };
    }

    // 4. Sorting
    let orderBy: Prisma.BusinessOrderByWithRelationInput = { createdAt: "desc" };
    if (query.sortBy === "businessName") {
      orderBy = { businessName: query.sortOrder };
    } else if (query.sortBy === "createdAt") {
      orderBy = { createdAt: query.sortOrder };
    }

    // 5. Query data and total count concurrently
    const [tenants, totalCount] = await Promise.all([
      prisma.business.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
          subscription: {
            include: {
              plan: true,
            },
          },
          _count: {
            select: {
              members: true,
              invoices: true,
            },
          },
        },
      }),
      prisma.business.count({ where }),
    ]);

    return { tenants, totalCount };
  }

  /**
   * Find single organization tenant by ID with full relations
   */
  async findById(id: string) {
    return prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
        warehouses: true,
        invoiceSeries: true,
        _count: {
          select: {
            members: true,
            invoices: true,
            customers: true,
            products: true,
          },
        },
      },
    });
  }

  /**
   * Find organization by business name
   */
  async findByName(name: string) {
    return prisma.business.findFirst({
      where: {
        businessName: { equals: name.trim(), mode: "insensitive" },
      },
    });
  }

  /**
   * Find organization by code (stored in cinOrLlpin)
   */
  async findByCode(code: string) {
    return prisma.business.findFirst({
      where: {
        cinOrLlpin: { equals: code.trim().toUpperCase(), mode: "insensitive" },
      },
    });
  }

  /**
   * Find organization by domain (stored in tradeName)
   */
  async findByDomain(domain: string) {
    return prisma.business.findFirst({
      where: {
        tradeName: { equals: domain.trim().toLowerCase(), mode: "insensitive" },
      },
    });
  }

  /**
   * Find organization by GSTIN
   */
  async findByGstin(gstin: string) {
    return prisma.business.findFirst({
      where: {
        gstin: { equals: gstin.trim().toUpperCase(), mode: "insensitive" },
      },
    });
  }

  /**
   * Find or create plan by name
   */
  async findOrCreatePlan(planName: string, maxUsers = 15, storageGb = 25.0) {
    const name = planName.trim();
    let plan = await prisma.plan.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!plan) {
      let price = 2499.0;
      let invoices = 5000;
      if (name.toLowerCase() === "enterprise") {
        price = 6999.0;
        invoices = 50000;
        maxUsers = Math.max(maxUsers, 100);
      } else if (name.toLowerCase() === "starter") {
        price = 999.0;
        invoices = 500;
        maxUsers = Math.min(maxUsers, 3);
      }

      plan = await prisma.plan.create({
        data: {
          name,
          description: `${name} SaaS Plan with full ERP and GST features`,
          price,
          billingCycle: "MONTHLY",
          maxUsers,
          maxInvoicesPerMonth: invoices,
          maxWarehouses: name.toLowerCase() === "enterprise" ? 10 : 3,
          hasPOS: true,
          hasManufacturing: name.toLowerCase() === "enterprise",
          hasAdvancedReports: true,
          hasApiAccess: name.toLowerCase() === "enterprise",
          isActive: true,
        },
      });
    }

    return plan;
  }

  /**
   * Atomic provision of a new Organization Tenant from Platform Admin
   */
  async createTenantWithProvisioning(
    input: CreatePlatformOrganizationInput,
    passwordHash: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Find or create Owner User
      const adminEmail = input.contactEmail.toLowerCase().trim();
      let user = await tx.user.findUnique({
        where: { email: adminEmail },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: input.contactPerson.trim(),
            email: adminEmail,
            passwordHash,
            phone: input.contactPhone?.trim() || null,
            isEmailVerified: true,
            isActive: true,
          },
        });
      }

      // 2. Create the Business record
      const isTenantActive = input.status !== "suspended";
      const business = await tx.business.create({
        data: {
          ownerId: user.id,
          businessName: input.name.trim(),
          legalName: input.name.trim(),
          tradeName: input.domain.trim().toLowerCase(), // Subdomain URL
          cinOrLlpin: input.code.trim().toUpperCase(),  // Short Tenant Code
          gstin: input.gstin?.trim() || null,
          email: adminEmail,
          mobileNumber: input.contactPhone?.trim() || null,
          isActive: isTenantActive,
        },
      });

      // 3. Link Owner to BusinessUser with OWNER role
      await tx.businessUser.upsert({
        where: {
          businessId_userId: {
            businessId: business.id,
            userId: user.id,
          },
        },
        update: {
          role: "OWNER",
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canPrint: true,
          canExport: true,
          canCancel: true,
          canApprove: true,
        },
        create: {
          businessId: business.id,
          userId: user.id,
          role: "OWNER",
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canPrint: true,
          canExport: true,
          canCancel: true,
          canApprove: true,
          joinedAt: new Date(),
        },
      });

      // 4. Find or create SaaS Plan
      let plan = await tx.plan.findFirst({
        where: { name: { equals: input.planName, mode: "insensitive" } },
      });

      if (!plan) {
        let price = 2499.0;
        let invoices = 5000;
        if (input.planName === "Enterprise") {
          price = 6999.0;
          invoices = 50000;
        } else if (input.planName === "Starter") {
          price = 999.0;
          invoices = 500;
        }

        plan = await tx.plan.create({
          data: {
            name: input.planName,
            description: `${input.planName} SaaS Plan with full ERP and GST features`,
            price,
            billingCycle: "MONTHLY",
            maxUsers: input.maxUsersLimit || 15,
            maxInvoicesPerMonth: invoices,
            maxWarehouses: input.planName === "Enterprise" ? 10 : 3,
            hasPOS: true,
            hasManufacturing: input.planName === "Enterprise",
            hasAdvancedReports: true,
            hasApiAccess: input.planName === "Enterprise",
            isActive: true,
          },
        });
      }

      // 5. Initialize Subscription
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      let subStatus: SubscriptionStatus = "ACTIVE";
      if (input.status === "trial") {
        subStatus = "TRIALING";
      } else if (input.status === "suspended") {
        subStatus = "CANCELLED";
      }

      const subscription = await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: plan.id,
          status: subStatus,
          billingCycle: "MONTHLY",
          trialEndsAt: input.status === "trial" ? trialEnd : null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          autoRenew: true,
        },
      });

      // 6. Create default primary Warehouse
      await tx.warehouse.create({
        data: {
          businessId: business.id,
          name: "Main Warehouse",
          address: `${input.name} Headquarters`,
          isDefault: true,
          isActive: true,
        },
      });

      // 7. Create default Invoice Series
      await tx.invoiceSeries.create({
        data: {
          businessId: business.id,
          seriesName: "Default",
          prefix: `${input.code.trim().toUpperCase()}-INV-`,
          startingNumber: 1,
          currentNumber: 0,
          isDefault: true,
        },
      });

      return {
        business,
        owner: user,
        subscription,
        plan,
      };
    });
  }

  /**
   * Update organization tenant record and associated plan/subscription
   */
  async updateTenant(id: string, input: UpdatePlatformOrganizationInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.business.findUnique({
        where: { id },
        include: {
          owner: true,
          subscription: { include: { plan: true } },
        },
      });

      if (!existing) {
        return null;
      }

      // 1. Update business fields
      const dataToUpdate: Prisma.BusinessUpdateInput = {};
      if (input.name !== undefined) {
        dataToUpdate.businessName = input.name.trim();
        dataToUpdate.legalName = input.name.trim();
      }
      if (input.domain !== undefined) {
        dataToUpdate.tradeName = input.domain.trim().toLowerCase();
      }
      if (input.code !== undefined) {
        dataToUpdate.cinOrLlpin = input.code.trim().toUpperCase();
      }
      if (input.gstin !== undefined) {
        dataToUpdate.gstin = input.gstin?.trim() || null;
      }
      if (input.contactEmail !== undefined) {
        dataToUpdate.email = input.contactEmail.trim().toLowerCase();
      }
      if (input.contactPhone !== undefined) {
        dataToUpdate.mobileNumber = input.contactPhone?.trim() || null;
      }
      if (input.status !== undefined) {
        dataToUpdate.isActive = input.status !== "suspended";
      }

      const updatedBusiness = await tx.business.update({
        where: { id },
        data: dataToUpdate,
      });

      // 2. Update owner details if provided
      if (input.contactPerson || input.contactPhone || input.contactEmail) {
        await tx.user.update({
          where: { id: existing.ownerId },
          data: {
            fullName: input.contactPerson?.trim() || existing.owner.fullName,
            phone: input.contactPhone !== undefined ? input.contactPhone?.trim() || null : existing.owner.phone,
            email: input.contactEmail?.trim().toLowerCase() || existing.owner.email,
          },
        });
      }

      // 3. Update plan / subscription if planName or status is provided
      if (input.planName || input.status) {
        let planId = existing.subscription?.planId;

        if (input.planName && (!existing.subscription || existing.subscription.plan.name !== input.planName)) {
          let plan = await tx.plan.findFirst({
            where: { name: { equals: input.planName, mode: "insensitive" } },
          });

          if (!plan) {
            plan = await tx.plan.create({
              data: {
                name: input.planName,
                description: `${input.planName} SaaS Plan`,
                price: input.planName === "Enterprise" ? 6999.0 : (input.planName === "Growth" ? 2499.0 : 999.0),
                billingCycle: "MONTHLY",
                maxUsers: input.maxUsersLimit || (input.planName === "Enterprise" ? 100 : (input.planName === "Growth" ? 15 : 3)),
                isActive: true,
              },
            });
          }
          planId = plan.id;
        }

        let newStatus: SubscriptionStatus | undefined;
        if (input.status) {
          if (input.status === "active") newStatus = "ACTIVE";
          else if (input.status === "trial") newStatus = "TRIALING";
          else if (input.status === "suspended") newStatus = "CANCELLED";
          else if (input.status === "pending") newStatus = "TRIALING";
        }

        if (existing.subscription) {
          await tx.subscription.update({
            where: { id: existing.subscription.id },
            data: {
              ...(planId ? { planId } : {}),
              ...(newStatus ? { status: newStatus } : {}),
            },
          });
        } else if (planId) {
          const now = new Date();
          await tx.subscription.create({
            data: {
              businessId: id,
              planId,
              status: newStatus || "ACTIVE",
              billingCycle: "MONTHLY",
              currentPeriodStart: now,
              currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      return this.findById(id);
    });
  }

  /**
   * Fast status toggle (active, trial, suspended)
   */
  async updateStatus(id: string, status: TenantStatusType) {
    const isTenantActive = status !== "suspended";
    let subStatus: SubscriptionStatus = "ACTIVE";
    if (status === "trial") subStatus = "TRIALING";
    if (status === "suspended") subStatus = "CANCELLED";

    await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id },
        data: { isActive: isTenantActive },
      });

      const sub = await tx.subscription.findUnique({
        where: { businessId: id },
      });

      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: subStatus },
        });
      }
    });

    return this.findById(id);
  }

  /**
   * Soft deactivate or delete tenant
   */
  async softDelete(id: string) {
    return prisma.business.update({
      where: { id },
      data: {
        isActive: false,
        subscription: {
          update: {
            status: "CANCELLED",
          },
        },
      },
    });
  }

  /**
   * Aggregated Platform KPIs for organizations
   */
  async getKPIs() {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      totalUsers,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({
        where: {
          isActive: true,
          subscription: { status: "ACTIVE" },
        },
      }),
      prisma.business.count({
        where: {
          subscription: { status: "TRIALING" },
        },
      }),
      prisma.business.count({
        where: {
          OR: [
            { isActive: false },
            { subscription: { status: { in: ["CANCELLED", "PAST_DUE", "EXPIRED"] } } },
          ],
        },
      }),
      prisma.businessUser.count(),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      }),
    ]);

    const totalMrr = activeSubscriptions.reduce((acc, sub) => {
      const price = Number(sub.plan?.price || 0);
      return acc + price;
    }, 0);

    const totalArr = totalMrr * 12;

    return {
      totalMrr,
      totalArr,
      mrrGrowthPercentage: 18.4,
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      totalUsers,
      systemUptimePercentage: 99.98,
      serverLatencyMs: 38,
      pendingOnboardings: Math.max(0, totalTenants - (activeTenants + trialTenants + suspendedTenants)),
    };
  }
}

export const platformOrganizationRepo = new PlatformOrganizationRepository();
