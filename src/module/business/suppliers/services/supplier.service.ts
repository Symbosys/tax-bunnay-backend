import { prisma } from "../../../../db/prisma";
import { LedgerEntryType } from "../../../../generated/prisma/enums";
import { ErrorResponse } from "../../../../utils/response.util";
import { supplierRepo, SupplierRepository } from "../repo/supplier.repo";
import type {
  CreateSupplierInput,
  SupplierQueryParams,
  UpdateSupplierInput,
} from "../validators/supplier.validators";

export class SupplierService {
  private repo: SupplierRepository;

  constructor(repo: SupplierRepository = supplierRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format supplier database entity to API response format
   * Guarantees compatibility with both Flutter frontend fields and backend Prisma schema
   */
  private formatSupplier(supplier: any, dynamicBalance?: number) {
    const openingBal = Number(supplier.openingBalance ?? 0);
    const calculatedBal =
      dynamicBalance !== undefined ? dynamicBalance + openingBal : openingBal;

    const gstinStr = supplier.gstin ?? "";
    let stateCode = "";
    if (gstinStr.length === 15) {
      stateCode = gstinStr.substring(0, 2);
    }

    const creditTermsDays =
      parseInt(supplier.creditTerms ?? "0", 10) || 0;

    return {
      id: supplier.id,
      businessId: supplier.businessId,
      name: supplier.name,
      gstin: gstinStr,
      pan: supplier.pan ?? "",
      mobile: supplier.mobileNumber ?? "",
      mobileNumber: supplier.mobileNumber ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      state: supplier.state ?? "",
      stateCode: stateCode,
      creditTerms: creditTermsDays,
      openingBalance: openingBal,
      currentBalance: calculatedBal,
      supplierGroup: supplier.supplierGroup ?? "General",
      notes: supplier.notes ?? "",
      isRegistered: Boolean(gstinStr && gstinStr.length === 15),
      isActive: Boolean(supplier.isActive),
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      _count: supplier._count,
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
   * Create a new Supplier under Business Master
   * Handles duplicate GSTIN detection and creates opening balance ledger entry
   */
  async createSupplier(businessId: string, input: CreateSupplierInput) {
    await this.validateBusiness(businessId);

    // 1. Duplicate check for GSTIN within the same business
    if (input.gstin && input.gstin.length > 0) {
      const existingWithGstin = await this.repo.findByGstin(
        businessId,
        input.gstin
      );
      if (existingWithGstin) {
        throw new ErrorResponse(
          `A supplier with GSTIN "${input.gstin}" already exists (${existingWithGstin.name}).`,
          409
        );
      }
    }

    // 2. Duplicate mobile number check
    if (input.mobileNumber && input.mobileNumber.length > 0) {
      const existingWithMobile = await this.repo.findByMobile(
        businessId,
        input.mobileNumber
      );
      if (existingWithMobile) {
        throw new ErrorResponse(
          `A supplier with mobile number "${input.mobileNumber}" already exists (${existingWithMobile.name}).`,
          409
        );
      }
    }

    // 3. Create supplier record in database
    const supplier = await this.repo.create(businessId, input);

    // 4. Record opening balance in party ledger if opening balance > 0 (SRS Sec. 14)
    // For a supplier, opening balance is a CREDIT entry (payable to vendor)
    if (Number(supplier.openingBalance) > 0) {
      try {
        await prisma.ledgerEntry.create({
          data: {
            businessId,
            supplierId: supplier.id,
            particulars: "Opening Balance",
            entryType: LedgerEntryType.CREDIT,
            debitAmount: 0,
            creditAmount: supplier.openingBalance,
            runningBalance: supplier.openingBalance,
            referenceNumber: `OPB-${supplier.id.substring(supplier.id.length - 6).toUpperCase()}`,
          },
        });
      } catch (err) {
        console.warn(
          "[SupplierService] Could not create opening balance ledger entry:",
          err
        );
      }
    }

    return this.formatSupplier(supplier, 0);
  }

  /**
   * Search, filter, and paginate suppliers directory
   */
  async getSuppliers(businessId: string, query: SupplierQueryParams) {
    await this.validateBusiness(businessId);

    const result = await this.repo.findAll(businessId, query);

    // Calculate dynamic balances for current page suppliers
    const supplierIds = result.suppliers.map((s: any) => s.id);
    const balances = await this.repo.calculateSupplierBalances(
      businessId,
      supplierIds
    );

    const formattedList = result.suppliers.map((s: any) => {
      const dynamicDue = balances.get(s.id) ?? 0;
      return this.formatSupplier(s, dynamicDue);
    });

    return {
      suppliers: formattedList,
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
   * Get single supplier by ID with full transaction history and statistics
   */
  async getSupplierById(businessId: string, supplierId: string) {
    await this.validateBusiness(businessId);

    const supplier = await this.repo.findDetailById(businessId, supplierId);
    if (!supplier) {
      throw new ErrorResponse(
        "Supplier profile not found in this organization.",
        404
      );
    }

    const balances = await this.repo.calculateSupplierBalances(businessId, [
      supplierId,
    ]);
    const dynamicDue = balances.get(supplierId) ?? 0;

    const purchases: any[] = (supplier as any).purchases || [];
    const payments: any[] = (supplier as any).payments || [];
    const ledgerEntries: any[] = (supplier as any).ledgerEntries || [];
    const counts = (supplier as any)._count || {
      purchases: 0,
      payments: 0,
      ledgerEntries: 0,
      debitNotes: 0,
    };

    // Calculate lifetime financial metrics
    const totalPurchasesAmount = purchases.reduce(
      (acc: number, pur: any) => acc + Number(pur.totalAmount ?? 0),
      0
    );
    const totalPaymentsAmount = payments.reduce(
      (acc: number, pay: any) => acc + Number(pay.amount ?? 0),
      0
    );

    return {
      ...this.formatSupplier(supplier, dynamicDue),
      statistics: {
        totalPurchases: counts.purchases,
        totalPayments: counts.payments,
        totalLedgerEntries: counts.ledgerEntries,
        lifetimePurchasedValue: totalPurchasesAmount,
        lifetimePaymentsValue: totalPaymentsAmount,
      },
      recentPurchases: purchases,
      recentPayments: payments,
      recentLedgerEntries: ledgerEntries,
    };
  }

  /**
   * Update existing supplier
   */
  async updateSupplier(
    businessId: string,
    supplierId: string,
    input: UpdateSupplierInput
  ) {
    await this.validateBusiness(businessId);

    // Verify supplier exists
    const existing = await this.repo.findById(businessId, supplierId);
    if (!existing) {
      throw new ErrorResponse("Supplier not found to update.", 404);
    }

    // Duplicate GSTIN check if GSTIN is changing
    if (input.gstin && input.gstin !== existing.gstin) {
      const duplicateGstin = await this.repo.findByGstin(
        businessId,
        input.gstin,
        supplierId
      );
      if (duplicateGstin) {
        throw new ErrorResponse(
          `Another supplier with GSTIN "${input.gstin}" already exists (${duplicateGstin.name}).`,
          409
        );
      }
    }

    // Duplicate Mobile check if mobile is changing
    if (input.mobileNumber && input.mobileNumber !== existing.mobileNumber) {
      const duplicateMobile = await this.repo.findByMobile(
        businessId,
        input.mobileNumber,
        supplierId
      );
      if (duplicateMobile) {
        throw new ErrorResponse(
          `Another supplier with mobile "${input.mobileNumber}" already exists (${duplicateMobile.name}).`,
          409
        );
      }
    }

    const updated = await this.repo.update(businessId, supplierId, input);

    const balances = await this.repo.calculateSupplierBalances(businessId, [
      supplierId,
    ]);
    const dynamicDue = balances.get(supplierId) ?? 0;

    return this.formatSupplier(updated, dynamicDue);
  }

  /**
   * Delete or soft-delete supplier
   * If supplier has transactions, soft deletes (isActive: false)
   * If no transactions exist, performs permanent database deletion
   */
  async deleteSupplier(businessId: string, supplierId: string) {
    await this.validateBusiness(businessId);

    const existing = await this.repo.findById(businessId, supplierId);
    if (!existing) {
      throw new ErrorResponse("Supplier not found to delete.", 404);
    }

    const counts = (existing as any)._count || {
      purchases: 0,
      payments: 0,
      ledgerEntries: 0,
      debitNotes: 0,
    };

    const hasRealTransactions =
      counts.purchases > 0 || counts.payments > 0 || counts.debitNotes > 0;

    if (hasRealTransactions) {
      await this.repo.softDelete(businessId, supplierId);
      return {
        isSoftDeleted: true,
        message: `Supplier has active transaction records. Supplier profile has been deactivated.`,
      };
    }

    // Clean up opening balance ledger entries if no purchases or payments exist
    await prisma.ledgerEntry.deleteMany({
      where: {
        businessId,
        supplierId,
      },
    });

    await this.repo.delete(businessId, supplierId);
    return {
      isSoftDeleted: false,
      message: "Supplier deleted successfully.",
    };
  }


  /**
   * Aggregate metrics for supplier directory
   */
  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }
}

export const supplierService = new SupplierService();
