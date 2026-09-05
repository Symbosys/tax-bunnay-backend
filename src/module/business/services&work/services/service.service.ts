import { prisma } from "../../../../db/prisma";
import { ErrorResponse } from "../../../../utils/response.util";
import { serviceRepo, ServiceRepository } from "../repo/service.repo";
import type {
  CreateServiceInput,
  ServiceQueryParams,
  UpdateServiceInput,
} from "../validators/service.validators";

export class ServiceService {
  private repo: ServiceRepository;

  constructor(repo: ServiceRepository = serviceRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format service entity for frontend API compatibility
   */
  private formatService(service: any) {
    const rate = Number(service.rate ?? 0);
    const gstRate = Number(service.gstRatePercent ?? 0);
    const discount = Number(service.discountPercent ?? 0);
    const code = service.serviceCode ?? "";

    return {
      id: service.id,
      businessId: service.businessId,
      name: service.name,
      code: code,
      serviceCode: code,
      sacCode: service.sacCode ?? "",
      description: service.description ?? "",
      rate: rate,
      gstRate: gstRate,
      gstRatePercent: gstRate,
      unit: service.unit ?? "Hour",
      discount: discount,
      discountPercent: discount,
      incomeLedger: service.incomeLedgerId ?? "Service Income",
      incomeLedgerId: service.incomeLedgerId ?? "",
      isActive: Boolean(service.isActive),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      _count: service._count,
    };
  }

  /**
   * Validate business existence and accessibility
   */
  private async validateBusiness(businessId: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse(
        "Business ID is required. Please select or switch an active business.",
        400
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, businessName: true, isActive: true },
    });

    if (!business) {
      throw new ErrorResponse("Target organization/business not found.", 404);
    }

    if (!business.isActive) {
      throw new ErrorResponse(
        "Target organization is currently inactive. Please contact your administrator.",
        403
      );
    }

    return business;
  }

  /**
   * Create a new Service under Business Master
   */
  async createService(businessId: string, input: CreateServiceInput) {
    await this.validateBusiness(businessId);

    // Auto-generate service code if omitted
    let finalCode = input.serviceCode;
    if (!finalCode || finalCode.trim().length === 0) {
      finalCode = `SRV-${Date.now().toString().slice(-6)}`;
    }

    // Duplicate check for service code within the same business
    const existingWithCode = await this.repo.findByCode(businessId, finalCode);
    if (existingWithCode) {
      throw new ErrorResponse(
        `A service with reference code "${finalCode}" already exists (${existingWithCode.name}).`,
        409
      );
    }

    const serviceData = {
      ...input,
      serviceCode: finalCode,
    };

    const service = await this.repo.create(businessId, serviceData);
    return this.formatService(service);
  }

  /**
   * Search, filter, and paginate services directory
   */
  async getServices(businessId: string, query: ServiceQueryParams) {
    await this.validateBusiness(businessId);

    const result = await this.repo.findAll(businessId, query);
    const formattedList = result.services.map((s: any) => this.formatService(s));

    return {
      services: formattedList,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    };
  }

  /**
   * Get single service by ID
   */
  async getServiceById(businessId: string, serviceId: string) {
    await this.validateBusiness(businessId);

    const service = await this.repo.findById(businessId, serviceId);
    if (!service) {
      throw new ErrorResponse(
        "Service item not found in this organization.",
        404
      );
    }

    return {
      ...this.formatService(service),
      usageStatistics: {
        invoicedCount: (service as any)._count?.invoiceItems ?? 0,
      },
    };
  }

  /**
   * Update existing service
   */
  async updateService(
    businessId: string,
    serviceId: string,
    input: UpdateServiceInput
  ) {
    await this.validateBusiness(businessId);

    // Verify service exists
    const existing = await this.repo.findById(businessId, serviceId);
    if (!existing) {
      throw new ErrorResponse("Service not found to update.", 404);
    }

    // Duplicate code check if code is changing
    if (input.serviceCode && input.serviceCode !== existing.serviceCode) {
      const duplicateCode = await this.repo.findByCode(
        businessId,
        input.serviceCode,
        serviceId
      );
      if (duplicateCode) {
        throw new ErrorResponse(
          `Another service with code "${input.serviceCode}" already exists (${duplicateCode.name}).`,
          409
        );
      }
    }

    const updated = await this.repo.update(businessId, serviceId, input);
    return this.formatService(updated);
  }

  /**
   * Delete or soft-delete service
   * If service has been billed in invoices, soft deletes (isActive: false)
   * If never billed, performs permanent database deletion
   */
  async deleteService(businessId: string, serviceId: string) {
    await this.validateBusiness(businessId);

    const existing = await this.repo.findById(businessId, serviceId);
    if (!existing) {
      throw new ErrorResponse("Service not found to delete.", 404);
    }

    const transactionCount = await this.repo.countTransactions(
      businessId,
      serviceId
    );

    if (transactionCount > 0) {
      await this.repo.softDelete(businessId, serviceId);
      return {
        isSoftDeleted: true,
        message: `Service has been billed in ${transactionCount} invoice line item(s). Service record has been deactivated to protect invoice history.`,
      };
    }

    await this.repo.delete(businessId, serviceId);
    return {
      isSoftDeleted: false,
      message: "Service item deleted successfully.",
    };
  }

  /**
   * Aggregate metrics for service directory
   */
  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }
}

export const serviceService = new ServiceService();
