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
    const plans = await this.repo.findAll();
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
