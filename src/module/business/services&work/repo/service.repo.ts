import { prisma } from "../../../../db/prisma";
import type { ServiceQueryParams } from "../validators/service.validators";

export class ServiceRepository {
  /**
   * Helper to resolve an income ledger account by ID or Name
   */
  private async resolveIncomeLedgerId(
    businessId: string,
    ledgerValue?: string | null
  ): Promise<string | null> {
    if (!ledgerValue || ledgerValue.trim().length === 0) return null;
    const trimmed = ledgerValue.trim();

    // 1. Try finding by ID
    const accountById = await prisma.account.findFirst({
      where: { id: trimmed, businessId },
      select: { id: true },
    });
    if (accountById) return accountById.id;

    // 2. Try finding by Name (case-insensitive)
    const accountByName = await prisma.account.findFirst({
      where: {
        name: { equals: trimmed, mode: "insensitive" },
        businessId,
      },
      select: { id: true },
    });
    if (accountByName) return accountByName.id;

    return null;
  }

  /**
   * Create a new Service record linked to a Business
   */
  async create(businessId: string, data: any) {
    const { incomeLedger, incomeLedgerId, ...rest } = data;
    const resolvedLedgerId = await this.resolveIncomeLedgerId(
      businessId,
      incomeLedgerId ?? incomeLedger
    );

    return prisma.service.create({
      data: {
        businessId,
        ...rest,
        incomeLedgerId: resolvedLedgerId,
      },
    });
  }

  /**
   * Find service by ID scoped to Business
   */
  async findById(businessId: string, id: string) {
    return prisma.service.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        incomeLedger: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            invoiceItems: true,
          },
        },
      },
    });
  }

  /**
   * Search, filter, and paginate services for Services Directory
   */
  async findAll(businessId: string, params: ServiceQueryParams) {
    const {
      search,
      unit,
      isActive,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: any = {
      businessId,
      // Default to returning active services only
      isActive: isActive !== undefined ? isActive : true,
    };

    // Filter by billing unit (Hour, Day, Trip, etc.)
    if (unit && unit.trim().length > 0 && unit !== "All") {
      where.unit = {
        equals: unit.trim(),
        mode: "insensitive",
      };
    }

    // Search query matching Name, Service Code, or SAC Code
    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { serviceCode: { contains: q, mode: "insensitive" } },
        { sacCode: { contains: q } },
      ];
    }

    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              invoiceItems: true,
            },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return {
      services,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Update Service record
   */
  async update(businessId: string, id: string, data: any) {
    const { incomeLedger, incomeLedgerId, ...rest } = data;
    const updateData: any = { ...rest };

    if (incomeLedger !== undefined || incomeLedgerId !== undefined) {
      updateData.incomeLedgerId = await this.resolveIncomeLedgerId(
        businessId,
        incomeLedgerId ?? incomeLedger
      );
    }

    return prisma.service.update({
      where: {
        id,
      },
      data: updateData,
    });
  }

  /**
   * Soft delete Service (set isActive: false)
   */
  async softDelete(businessId: string, id: string) {
    return prisma.service.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Hard delete Service
   */
  async delete(businessId: string, id: string) {
    return prisma.service.delete({
      where: {
        id,
      },
    });
  }

  /**
   * Check for duplicate Service Code within the same Business
   */
  async findByCode(businessId: string, serviceCode: string, excludeId?: string) {
    return prisma.service.findFirst({
      where: {
        businessId,
        serviceCode: {
          equals: serviceCode.trim(),
          mode: "insensitive",
        },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * Count invoice line items referencing this service
   */
  async countTransactions(businessId: string, id: string) {
    const service = await prisma.service.findFirst({
      where: { id, businessId },
      select: {
        _count: {
          select: {
            invoiceItems: true,
          },
        },
      },
    });

    return service?._count.invoiceItems ?? 0;
  }

  /**
   * High-level metrics for services directory
   */
  async getMetrics(businessId: string) {
    const [total, active, gstApplicable, rateAgg] = await Promise.all([
      prisma.service.count({ where: { businessId, isActive: true } }),
      prisma.service.count({ where: { businessId, isActive: true } }),
      prisma.service.count({
        where: {
          businessId,
          isActive: true,
          gstRatePercent: { gt: 0 },
        },
      }),
      prisma.service.aggregate({
        where: { businessId, isActive: true },
        _avg: {
          rate: true,
        },
      }),
    ]);

    const averageRate = Number(rateAgg._avg?.rate ?? 0);

    return {
      totalServices: total,
      activeServices: active,
      inactiveServices: 0,
      gstApplicableServices: gstApplicable,
      exemptServices: total - gstApplicable,
      averageRate,
    };
  }
}

export const serviceRepo = new ServiceRepository();
