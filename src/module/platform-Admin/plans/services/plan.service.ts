import { ErrorResponse } from "../../../../utils/response.util";
import {
  PlatformPlanRepository,
  platformPlanRepo,
} from "../repo/plan.repo";
import type {
  CreatePlanInput,
  UpdatePlanInput,
} from "../validators/plan.validators";

export interface PlatformPlanDTO {
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
  activeTenantsCount: number;
  themeColor: string;
}

export class PlatformPlanService {
  private repo: PlatformPlanRepository;

  constructor(repo: PlatformPlanRepository = platformPlanRepo) {
    this.repo = repo;
  }

  /**
   * Helper to map DB plan to Flutter PlatformPlan DTO
   */
  mapToPlanDTO(plan: any): PlatformPlanDTO {
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
      isPopular: Boolean(metadata.isPopular ?? plan.name.toLowerCase() === "growth"),
      activeTenantsCount: plan._count?.subscriptions || 0,
      themeColor: metadata.themeColor || defaultThemeColor,
    };
  }

  /**
   * Retrieve all active SaaS plans
   */
  async getAllPlans(): Promise<PlatformPlanDTO[]> {
    let plans = await this.repo.findAll();

    // If no plans exist yet in DB, bootstrap default Starter, Growth, Enterprise
    if (plans.length === 0) {
      await this.repo.create({
        name: "Starter",
        tagline: "Ideal for small retail businesses, startups and standalone stores.",
        priceMonthly: 999.0,
        priceYearly: 9990.0,
        maxUsers: 3,
        maxInvoicesPerMonth: 500,
        storageLimitGb: 5.0,
        features: [
          "Up to 3 Team Members",
          "500 GST Invoices / Month",
          "Basic Inventory & Barcode Scan",
          "Standard Email Invoices",
          "5 GB Cloud Storage",
          "Standard Support (24h SLA)",
        ],
        isPopular: false,
        themeColor: "#2563EB",
      });

      await this.repo.create({
        name: "Growth",
        tagline: "Best for scaling wholesalers, multi-location shops, and expanding businesses.",
        priceMonthly: 2499.0,
        priceYearly: 24990.0,
        maxUsers: 15,
        maxInvoicesPerMonth: 5000,
        storageLimitGb: 25.0,
        features: [
          "Up to 15 Team Members",
          "5,000 Invoices / Month",
          "Multi-Warehouse Inventory",
          "Double-Entry Accounting & Ledger",
          "Automated GSTR-1 & 3B Filing Portal",
          "25 GB Cloud Storage",
          "Priority Phone & Chat Support (4h SLA)",
        ],
        isPopular: true,
        themeColor: "#15803D",
      });

      await this.repo.create({
        name: "Enterprise",
        tagline: "Complete ERP suite with custom domain, unlimited scale & manufacturing.",
        priceMonthly: 6999.0,
        priceYearly: 69990.0,
        maxUsers: 100,
        maxInvoicesPerMonth: 50000,
        storageLimitGb: 100.0,
        features: [
          "Up to 100 Team Members",
          "Unlimited Invoices & Transactions",
          "Manufacturing, BOM & Job Work",
          "Custom Subdomain / White-labeling",
          "Advanced RBAC & Audit Trails",
          "100 GB High-Speed Storage",
          "Dedicated Account Manager (1h SLA)",
          "Automated Daily Offsite Backups",
        ],
        isPopular: false,
        themeColor: "#6D28D9",
      });

      plans = await this.repo.findAll();
    }

    return plans.map((p) => this.mapToPlanDTO(p));
  }

  /**
   * Create a new plan
   */
  async createPlan(input: CreatePlanInput): Promise<PlatformPlanDTO> {
    const existing = await this.repo.findByName(input.name);
    if (existing) {
      throw new ErrorResponse(
        `A subscription plan named "${input.name}" already exists.`,
        409
      );
    }

    const created = await this.repo.create(input);
    return this.mapToPlanDTO(created);
  }

  /**
   * Update an existing plan
   */
  async updatePlan(id: string, input: UpdatePlanInput): Promise<PlatformPlanDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new ErrorResponse(`Plan with ID "${id}" not found`, 404);
    }

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const nameTaken = await this.repo.findByName(input.name);
      if (nameTaken && nameTaken.id !== id) {
        throw new ErrorResponse(`Plan name "${input.name}" is already taken`, 409);
      }
    }

    const updated = await this.repo.update(id, input, existing.description);
    return this.mapToPlanDTO(updated);
  }

  /**
   * Delete / Deactivate plan
   */
  async deletePlan(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new ErrorResponse(`Plan with ID "${id}" not found`, 404);
    }

    const activeCount = existing._count?.subscriptions || 0;
    if (activeCount > 0) {
      throw new ErrorResponse(
        `Cannot delete plan "${existing.name}" because it currently has ${activeCount} active subscriber organization(s). Please migrate subscribers first.`,
        400
      );
    }

    await this.repo.delete(id);
    return {
      message: `Plan "${existing.name}" has been deleted successfully.`,
      id,
    };
  }
}

export const platformPlanService = new PlatformPlanService();
