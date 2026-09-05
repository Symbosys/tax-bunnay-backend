import bcrypt from "bcrypt";
import env from "../../../../config/env.config";
import { signToken } from "../../../../utils/jwt.util";
import { ErrorResponse } from "../../../../utils/response.util";
import {
  PlatformOrganizationRepository,
  platformOrganizationRepo,
} from "../repo/organization.repo";
import type {
  CreatePlatformOrganizationInput,
  PlatformOrganizationQueryInput,
  UpdatePlatformOrganizationInput,
  TenantStatusType,
} from "../validators/organization.validators";

export interface OrganizationTenantDTO {
  id: string;
  name: string;
  code: string;
  domain: string;
  gstin: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  planId: string;
  planName: string;
  status: TenantStatusType;
  monthlySpend: number;
  totalInvoices: number;
  activeUsersCount: number;
  maxUsersLimit: number;
  storageUsedGb: number;
  storageLimitGb: number;
  createdAt: string;
  renewalDate: string;
}

export class PlatformOrganizationService {
  private repo: PlatformOrganizationRepository;

  constructor(repo: PlatformOrganizationRepository = platformOrganizationRepo) {
    this.repo = repo;
  }

  /**
   * Transforms database Business entity into the Flutter UI OrganizationTenant shape
   */
  mapToTenantDTO(business: any): OrganizationTenantDTO {
    // 1. Determine status
    let status: TenantStatusType = "active";
    if (!business.isActive) {
      status = "suspended";
    } else if (business.subscription?.status === "TRIALING") {
      status = "trial";
    } else if (
      business.subscription?.status === "CANCELLED" ||
      business.subscription?.status === "PAST_DUE" ||
      business.subscription?.status === "EXPIRED"
    ) {
      status = "suspended";
    } else if (!business.subscription) {
      status = "pending";
    }

    // 2. Resolve Code & Domain
    const name = business.businessName || "Organization";
    const code =
      business.cinOrLlpin ||
      name.replace(/\s+/g, "").toUpperCase().slice(0, 4) ||
      "ORG";

    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const domain =
      business.tradeName ||
      `${cleanSlug || "tenant"}.billing-erp.in`;

    // 3. Resolve Plan Info
    const plan = business.subscription?.plan;
    const planName = plan?.name || "Growth";
    const planId = plan?.id || "plan_growth";

    // 4. Resolve Monthly Spend
    let monthlySpend = Number(plan?.price || 0);
    if (status === "trial" || status === "suspended") {
      monthlySpend = 0.0;
    } else if (monthlySpend === 0) {
      if (planName.toLowerCase() === "enterprise") monthlySpend = 6999.0;
      else if (planName.toLowerCase() === "growth") monthlySpend = 2499.0;
      else monthlySpend = 999.0;
    }

    // 5. Usage & Limits
    const totalInvoices = business._count?.invoices ?? 0;
    const activeUsersCount = Math.max(1, business._count?.members ?? 1);

    let maxUsersLimit = plan?.maxUsers || 15;
    let storageLimitGb = 25.0;
    if (planName.toLowerCase() === "enterprise") {
      maxUsersLimit = Math.max(maxUsersLimit, 100);
      storageLimitGb = 100.0;
    } else if (planName.toLowerCase() === "starter") {
      maxUsersLimit = Math.min(maxUsersLimit, 3);
      storageLimitGb = 5.0;
    }

    // Calculate approximate storage used based on invoice records
    const storageUsedGb = Math.max(
      0.1,
      Number((0.1 + (totalInvoices * 0.002)).toFixed(2))
    );

    // 6. Dates
    const createdAt = business.createdAt
      ? new Date(business.createdAt).toISOString()
      : new Date().toISOString();

    const renewalDate = business.subscription?.currentPeriodEnd
      ? new Date(business.subscription.currentPeriodEnd).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      id: business.id,
      name,
      code,
      domain,
      gstin: business.gstin || "",
      contactPerson: business.owner?.fullName || "Primary Administrator",
      contactEmail: business.email || business.owner?.email || "",
      contactPhone: business.mobileNumber || business.owner?.phone || "",
      planId,
      planName,
      status,
      monthlySpend,
      totalInvoices,
      activeUsersCount,
      maxUsersLimit,
      storageUsedGb,
      storageLimitGb,
      createdAt,
      renewalDate,
    };
  }

  /**
   * List organizations with search, status filters, and KPIs
   */
  async listOrganizations(query: PlatformOrganizationQueryInput) {
    const { tenants, totalCount } = await this.repo.findAllWithFilters(query);
    const mappedTenants = tenants.map((t) => this.mapToTenantDTO(t));
    const kpis = await this.repo.getKPIs();

    return {
      tenants: mappedTenants,
      total: totalCount,
      kpis,
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Retrieve platform organization KPIs
   */
  async getOrganizationKPIs() {
    return this.repo.getKPIs();
  }

  /**
   * Retrieve single tenant organization by ID
   */
  async getOrganizationById(id: string) {
    const tenant = await this.repo.findById(id);
    if (!tenant) {
      throw new ErrorResponse(`Organization with ID "${id}" not found`, 404);
    }
    return this.mapToTenantDTO(tenant);
  }

  /**
   * Provision new organization tenant from Platform Admin
   */
  async createOrganization(input: CreatePlatformOrganizationInput) {
    // 1. Check for duplicate code
    const existingCode = await this.repo.findByCode(input.code);
    if (existingCode) {
      throw new ErrorResponse(
        `An organization with code "${input.code.toUpperCase()}" already exists.`,
        409
      );
    }

    // 2. Check for duplicate domain
    const existingDomain = await this.repo.findByDomain(input.domain);
    if (existingDomain) {
      throw new ErrorResponse(
        `The subdomain or domain "${input.domain.toLowerCase()}" is already assigned to "${existingDomain.businessName}".`,
        409
      );
    }

    // 3. Check for duplicate GSTIN if provided
    if (input.gstin && input.gstin.trim().length > 0) {
      const existingGstin = await this.repo.findByGstin(input.gstin);
      if (existingGstin) {
        throw new ErrorResponse(
          `The GSTIN "${input.gstin.toUpperCase()}" is already registered to "${existingGstin.businessName}".`,
          409
        );
      }
    }

    // 4. Hash initial password
    const rawPassword = input.password || "Tenant@123";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 5. Provision in DB
    const provisioned = await this.repo.createTenantWithProvisioning(
      input,
      passwordHash
    );

    // 6. Return populated DTO
    const fullTenant = await this.repo.findById(provisioned.business.id);
    return this.mapToTenantDTO(fullTenant);
  }

  /**
   * Update tenant organization
   */
  async updateOrganization(id: string, input: UpdatePlatformOrganizationInput) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new ErrorResponse(`Organization with ID "${id}" not found`, 404);
    }

    // Check code collision
    if (input.code && input.code.toUpperCase() !== existing.cinOrLlpin) {
      const codeTaken = await this.repo.findByCode(input.code);
      if (codeTaken && codeTaken.id !== id) {
        throw new ErrorResponse(`Code "${input.code}" is already in use by another organization`, 409);
      }
    }

    // Check domain collision
    if (input.domain && input.domain.toLowerCase() !== existing.tradeName) {
      const domainTaken = await this.repo.findByDomain(input.domain);
      if (domainTaken && domainTaken.id !== id) {
        throw new ErrorResponse(`Domain "${input.domain}" is already in use by another organization`, 409);
      }
    }

    const updated = await this.repo.updateTenant(id, input);
    return this.mapToTenantDTO(updated);
  }

  /**
   * Fast toggle organization status (active / trial / suspended)
   */
  async toggleStatus(id: string, status: TenantStatusType) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new ErrorResponse(`Organization with ID "${id}" not found`, 404);
    }

    const updated = await this.repo.updateStatus(id, status);
    return this.mapToTenantDTO(updated);
  }

  /**
   * Soft delete / deactivate organization
   */
  async deleteOrganization(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new ErrorResponse(`Organization with ID "${id}" not found`, 404);
    }

    await this.repo.softDelete(id);
    return {
      message: `Organization "${existing.businessName}" has been successfully suspended and deactivated.`,
      id,
    };
  }

  /**
   * Impersonate Tenant: Platform Admin generates a session token as the tenant owner
   */
  async generateImpersonationToken(id: string, currentAdminId?: string) {
    const business = await this.repo.findById(id);
    if (!business) {
      throw new ErrorResponse(`Organization with ID "${id}" not found`, 404);
    }

    const owner = business.owner;
    if (!owner) {
      throw new ErrorResponse("Organization has no assigned owner to impersonate", 400);
    }

    const jwtSecret = env.jwt.secret || "123456";
    const impersonationPayload = {
      id: owner.id,
      email: owner.email,
      fullName: owner.fullName,
      businessId: business.id,
      role: "OWNER",
      isPlatformAdmin: true,
      impersonatedBy: currentAdminId || "platform_admin",
      isImpersonating: true,
    };

    const token = signToken(impersonationPayload, jwtSecret, 4 * 3600);

    return {
      token,
      organization: {
        id: business.id,
        name: business.businessName,
        code: business.cinOrLlpin || business.businessName.slice(0, 4).toUpperCase(),
        domain: business.tradeName || `${business.businessName.toLowerCase()}.billing-erp.in`,
      },
      impersonatedUser: {
        id: owner.id,
        fullName: owner.fullName,
        email: owner.email,
        role: "OWNER",
      },
    };
  }
}

export const platformOrganizationService = new PlatformOrganizationService();
