import { prisma } from "../../../db/prisma";
import type { GstRegistrationType, BillingCycle } from "../../../generated/prisma/client";

export class OnboardingRepository {
  /**
   * Find organization / business by business name
   */
  async findBusinessByName(name: string) {
    return prisma.business.findFirst({
      where: {
        businessName: {
          equals: name.trim(),
          mode: "insensitive",
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  /**
   * Find business by unique GSTIN
   */
  async findBusinessByGstin(gstin: string) {
    return prisma.business.findFirst({
      where: {
        gstin: {
          equals: gstin.toUpperCase().trim(),
          mode: "insensitive",
        },
      },
    });
  }

  /**
   * Find business by email
   */
  async findBusinessByEmail(email: string) {
    return prisma.business.findFirst({
      where: {
        email: {
          equals: email.toLowerCase().trim(),
          mode: "insensitive",
        },
      },
    });
  }

  /**
   * Find business by ID with complete relations
   */
  async findBusinessById(id: string) {
    return prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
        warehouses: true,
        invoiceSeries: true,
      },
    });
  }

  /**
   * Find or retrieve SaaS plans
   */
  async findPlanByName(name: string) {
    return prisma.plan.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: "insensitive",
        },
      },
    });
  }

  /**
   * Retrieve all active SaaS plans
   */
  async getAllActivePlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });
  }

  /**
   * Atomically create the entire organization setup in a single transaction
   */
  async createOrganizationWithSetup(params: {
    // Owner User Details
    ownerData: {
      fullName: string;
      email: string;
      passwordHash: string;
      phone?: string | null;
    };
    // Business Details
    businessData: {
      businessName: string;
      legalName?: string | null;
      tradeName?: string | null;
      gstin?: string | null;
      pan?: string | null;
      tan?: string | null;
      cinOrLlpin?: string | null;
      businessAddress?: string | null;
      billingAddress?: string | null;
      shippingAddress?: string | null;
      state?: string | null;
      pinCode?: string | null;
      email?: string | null;
      mobileNumber?: string | null;
      financialYearStart?: Date | null;
      booksStartingDate?: Date | null;
      gstRegistrationType: GstRegistrationType;
      logoUrl?: string | null;
    };
    // SaaS Plan & Subscription
    planName: string;
    billingCycle: BillingCycle;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Find or create the user
      let user = await tx.user.findUnique({
        where: { email: params.ownerData.email.toLowerCase().trim() },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: params.ownerData.fullName.trim(),
            email: params.ownerData.email.toLowerCase().trim(),
            passwordHash: params.ownerData.passwordHash,
            phone: params.ownerData.phone?.trim() || null,
            isEmailVerified: true,
            isActive: true,
          },
        });
      }

      // 2. Find or create the Business record
      let business = await tx.business.findFirst({
        where: {
          ownerId: user.id,
          businessName: {
            equals: params.businessData.businessName.trim(),
            mode: "insensitive",
          },
        },
      });

      if (business) {
        business = await tx.business.update({
          where: { id: business.id },
          data: {
            legalName: params.businessData.legalName?.trim() || business.legalName,
            tradeName: params.businessData.tradeName?.trim() || business.tradeName,
            gstin: params.businessData.gstin?.trim() || business.gstin,
            pan: params.businessData.pan?.trim() || business.pan,
            tan: params.businessData.tan?.trim() || business.tan,
            cinOrLlpin: params.businessData.cinOrLlpin?.trim() || business.cinOrLlpin,
            businessAddress: params.businessData.businessAddress?.trim() || business.businessAddress,
            billingAddress: params.businessData.billingAddress?.trim() || business.billingAddress,
            shippingAddress: params.businessData.shippingAddress?.trim() || business.shippingAddress,
            state: params.businessData.state?.trim() || business.state,
            pinCode: params.businessData.pinCode?.trim() || business.pinCode,
            email: params.businessData.email?.trim() || business.email,
            mobileNumber: params.businessData.mobileNumber?.trim() || business.mobileNumber,
            financialYearStart: params.businessData.financialYearStart || business.financialYearStart,
            booksStartingDate: params.businessData.booksStartingDate || business.booksStartingDate,
            gstRegistrationType: params.businessData.gstRegistrationType,
            logoUrl: params.businessData.logoUrl || business.logoUrl,
            isActive: true,
          },
        });
      } else {
        business = await tx.business.create({
          data: {
            ownerId: user.id,
            businessName: params.businessData.businessName.trim(),
            legalName: params.businessData.legalName?.trim() || null,
            tradeName: params.businessData.tradeName?.trim() || null,
            gstin: params.businessData.gstin?.trim() || null,
            pan: params.businessData.pan?.trim() || null,
            tan: params.businessData.tan?.trim() || null,
            cinOrLlpin: params.businessData.cinOrLlpin?.trim() || null,
            businessAddress: params.businessData.businessAddress?.trim() || null,
            billingAddress: params.businessData.billingAddress?.trim() || null,
            shippingAddress: params.businessData.shippingAddress?.trim() || null,
            state: params.businessData.state?.trim() || null,
            pinCode: params.businessData.pinCode?.trim() || null,
            email: params.businessData.email?.trim() || null,
            mobileNumber: params.businessData.mobileNumber?.trim() || null,
            financialYearStart: params.businessData.financialYearStart || new Date(),
            booksStartingDate: params.businessData.booksStartingDate || new Date(),
            gstRegistrationType: params.businessData.gstRegistrationType,
            logoUrl: params.businessData.logoUrl || null,
            isActive: true,
          },
        });
      }

      // 3. Upsert BusinessUser association with OWNER role & full permissions
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

      // 4. Find or create the SaaS Plan
      let plan = await tx.plan.findFirst({
        where: {
          name: {
            equals: params.planName.trim(),
            mode: "insensitive",
          },
        },
      });

      if (!plan) {
        plan = await tx.plan.create({
          data: {
            name: params.planName.trim(),
            description: `${params.planName} Tier - Full ERP & Multi-User Access`,
            price: 1499.00,
            billingCycle: params.billingCycle,
            maxUsers: 10,
            maxInvoicesPerMonth: 5000,
            maxWarehouses: 3,
            hasPOS: true,
            hasManufacturing: true,
            hasAdvancedReports: true,
            hasApiAccess: true,
            isActive: true,
          },
        });
      }

      // 5. Upsert active trial Subscription
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const subscription = await tx.subscription.upsert({
        where: { businessId: business.id },
        update: {
          planId: plan.id,
          status: "TRIALING",
          billingCycle: params.billingCycle,
          autoRenew: true,
        },
        create: {
          businessId: business.id,
          planId: plan.id,
          status: "TRIALING",
          billingCycle: params.billingCycle,
          trialEndsAt: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          autoRenew: true,
        },
      });

      // 6. Find or create default primary Warehouse
      let warehouse = await tx.warehouse.findFirst({
        where: { businessId: business.id, isDefault: true },
      });

      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            businessId: business.id,
            name: "Main Warehouse",
            address: params.businessData.businessAddress || `${params.businessData.businessName} Primary Location`,
            isDefault: true,
            isActive: true,
          },
        });
      }

      // 7. Find or create default Invoice Series
      let invoiceSeries = await tx.invoiceSeries.findFirst({
        where: { businessId: business.id, isDefault: true },
      });

      if (!invoiceSeries) {
        invoiceSeries = await tx.invoiceSeries.create({
          data: {
            businessId: business.id,
            seriesName: "Default",
            prefix: "INV",
            financialYearTag: "26-27",
            startingNumber: 1,
            currentNumber: 0,
            isDefault: true,
          },
        });
      }

      // 8. Create default Basic Chart of Accounts if empty
      const existingAccountsCount = await tx.account.count({
        where: { businessId: business.id },
      });

      if (existingAccountsCount === 0) {
        const defaultAccounts = [
          { name: "Cash in Hand", accountType: "CASH" as const, openingBalance: 0 },
          { name: "Primary Bank Account", accountType: "BANK" as const, openingBalance: 0 },
          { name: "Sales Account", accountType: "SALES" as const, openingBalance: 0 },
          { name: "Purchase Account", accountType: "PURCHASE" as const, openingBalance: 0 },
          { name: "Input CGST", accountType: "INPUT_GST" as const, openingBalance: 0 },
          { name: "Input SGST", accountType: "INPUT_GST" as const, openingBalance: 0 },
          { name: "Input IGST", accountType: "INPUT_GST" as const, openingBalance: 0 },
          { name: "Output CGST", accountType: "OUTPUT_GST" as const, openingBalance: 0 },
          { name: "Output SGST", accountType: "OUTPUT_GST" as const, openingBalance: 0 },
          { name: "Output IGST", accountType: "OUTPUT_GST" as const, openingBalance: 0 },
        ];

        await tx.account.createMany({
          data: defaultAccounts.map((acc) => ({
            businessId: business.id,
            name: acc.name,
            accountType: acc.accountType,
            openingBalance: acc.openingBalance,
            isActive: true,
          })),
        });
      }

      return {
        user,
        business,
        subscription,
        plan,
        warehouse,
        invoiceSeries,
      };
    });
  }

  /**
   * List recent onboarded organizations with pagination
   */
  async listRecentOrganizations(limit: number = 20, offset: number = 0) {
    const [tenants, total] = await Promise.all([
      prisma.business.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
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
              products: true,
              customers: true,
            },
          },
        },
      }),
      prisma.business.count(),
    ]);

    return { tenants, total };
  }
}

export const onboardingRepo = new OnboardingRepository();
