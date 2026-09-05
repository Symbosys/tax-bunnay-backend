import { prisma } from "../../../../db/prisma";
import { LedgerEntryType } from "../../../../generated/prisma/enums";
import { ErrorResponse } from "../../../../utils/response.util";
import { customerRepo, CustomerRepository } from "../repo/customer.repo";
import type {
  CreateCustomerInput,
  CustomerQueryParams,
  UpdateCustomerInput,
} from "../validators/customer.validators";

export class CustomerService {
  private repo: CustomerRepository;

  constructor(repo: CustomerRepository = customerRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format customer database entity to API response format
   * Guarantees compatibility with both Flutter frontend fields and backend Prisma schema
   */
  private formatCustomer(customer: any, dynamicBalance?: number) {
    const openingBal = Number(customer.openingBalance ?? 0);
    const calculatedBal =
      dynamicBalance !== undefined ? dynamicBalance + openingBal : openingBal;

    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      customerType: customer.customerType,
      type: customer.customerGroup || customer.customerType || "Retail",
      isRegistered: Boolean(customer.isRegistered),
      gstin: customer.gstin ?? "",
      pan: customer.pan ?? "",
      mobile: customer.mobileNumber ?? "",
      mobileNumber: customer.mobileNumber ?? "",
      email: customer.email ?? "",
      billingAddress: customer.billingAddress ?? "",
      shippingAddress: customer.shippingAddress ?? "",
      state: customer.state ?? "",
      stateCode: customer.stateCode ?? "",
      creditLimit: Number(customer.creditLimit ?? 0),
      creditPeriod: Number(customer.creditPeriodDays ?? 0),
      creditPeriodDays: Number(customer.creditPeriodDays ?? 0),
      openingBalance: openingBal,
      currentBalance: calculatedBal,
      customerGroup: customer.customerGroup ?? "General",
      priceList: customer.priceList ?? "",
      notes: customer.notes ?? "",
      isActive: Boolean(customer.isActive),
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      _count: customer._count,
    };
  }

  /**
   * Validate business existence and accessibility
   */
  private async validateBusiness(businessId: string) {
    if (!businessId || businessId.trim().length === 0) {
      throw new ErrorResponse("Business ID is required. Please select or switch an active business.", 400);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, businessName: true, isActive: true },
    });

    if (!business) {
      throw new ErrorResponse("Target organization/business not found.", 404);
    }

    if (!business.isActive) {
      throw new ErrorResponse("Target organization is currently inactive. Please contact your administrator.", 403);
    }

    return business;
  }

  /**
   * Create a new Customer under Business Master
   * Handles duplicate GSTIN detection and optional initial ledger entry for opening balance
   */
  async createCustomer(businessId: string, input: CreateCustomerInput) {
    await this.validateBusiness(businessId);

    // 1. Duplicate check for GSTIN within the same business
    if (input.gstin && input.gstin.length > 0) {
      const existingWithGstin = await this.repo.findByGstin(
        businessId,
        input.gstin
      );
      if (existingWithGstin) {
        throw new ErrorResponse(
          `A customer with GSTIN "${input.gstin}" already exists (${existingWithGstin.name}).`,
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
          `A customer with mobile number "${input.mobileNumber}" already exists (${existingWithMobile.name}).`,
          409
        );
      }
    }

    // 3. Create customer record in database
    const customer = await this.repo.create(businessId, input);

    // 4. Record opening balance in party ledger if opening balance > 0 (SRS Sec. 14)
    if (Number(customer.openingBalance) > 0) {
      try {
        await prisma.ledgerEntry.create({
          data: {
            businessId,
            customerId: customer.id,
            particulars: "Opening Balance",
            entryType: LedgerEntryType.DEBIT,
            debitAmount: customer.openingBalance,
            creditAmount: 0,
            runningBalance: customer.openingBalance,
            referenceNumber: `OPB-${customer.id.substring(customer.id.length - 6).toUpperCase()}`,
          },
        });
      } catch (err) {
        console.warn("[CustomerService] Could not create opening balance ledger entry:", err);
      }
    }

    return this.formatCustomer(customer, 0);
  }

  /**
   * Search, filter, and paginate customers directory
   */
  async getCustomers(businessId: string, query: CustomerQueryParams) {
    await this.validateBusiness(businessId);

    const result = await this.repo.findAll(businessId, query);

    // Calculate dynamic balances for current page customers
    const customerIds = result.customers.map((c: any) => c.id);
    const balances = await this.repo.calculateCustomerBalances(businessId, customerIds);

    const formattedList = result.customers.map((c: any) => {
      const dynamicDue = balances.get(c.id) ?? 0;
      return this.formatCustomer(c, dynamicDue);
    });

    return {
      customers: formattedList,
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
   * Get single customer by ID with full transaction history and statistics
   */
  async getCustomerById(businessId: string, customerId: string) {
    await this.validateBusiness(businessId);

    const customer = await this.repo.findDetailById(businessId, customerId);
    if (!customer) {
      throw new ErrorResponse("Customer profile not found in this organization.", 404);
    }

    const balances = await this.repo.calculateCustomerBalances(businessId, [customerId]);
    const dynamicDue = balances.get(customerId) ?? 0;

    const invoices: any[] = (customer as any).invoices || [];
    const receipts: any[] = (customer as any).receipts || [];
    const ledgerEntries: any[] = (customer as any).ledgerEntries || [];
    const counts = (customer as any)._count || { invoices: 0, receipts: 0, ledgerEntries: 0 };

    // Calculate lifetime financial metrics
    const totalInvoicesAmount = invoices.reduce(
      (acc: number, inv: any) => acc + Number(inv.grandTotal ?? 0),
      0
    );
    const totalReceiptsAmount = receipts.reduce(
      (acc: number, rec: any) => acc + Number(rec.amount ?? 0),
      0
    );

    return {
      ...this.formatCustomer(customer, dynamicDue),
      statistics: {
        totalInvoices: counts.invoices,
        totalReceipts: counts.receipts,
        totalLedgerEntries: counts.ledgerEntries,
        lifetimeInvoiceValue: totalInvoicesAmount,
        lifetimeReceiptValue: totalReceiptsAmount,
      },
      recentInvoices: invoices,
      recentReceipts: receipts,
      recentLedgerEntries: ledgerEntries,
    };
  }

  /**
   * Update existing customer
   */
  async updateCustomer(
    businessId: string,
    customerId: string,
    input: UpdateCustomerInput
  ) {
    await this.validateBusiness(businessId);

    // Verify customer exists
    const existing = await this.repo.findById(businessId, customerId);
    if (!existing) {
      throw new ErrorResponse("Customer not found to update.", 404);
    }

    // Duplicate GSTIN check if GSTIN is changing
    if (input.gstin && input.gstin !== existing.gstin) {
      const duplicateGstin = await this.repo.findByGstin(
        businessId,
        input.gstin,
        customerId
      );
      if (duplicateGstin) {
        throw new ErrorResponse(
          `Another customer with GSTIN "${input.gstin}" already exists (${duplicateGstin.name}).`,
          409
        );
      }
    }

    // Duplicate Mobile check if mobile is changing
    if (input.mobileNumber && input.mobileNumber !== existing.mobileNumber) {
      const duplicateMobile = await this.repo.findByMobile(
        businessId,
        input.mobileNumber,
        customerId
      );
      if (duplicateMobile) {
        throw new ErrorResponse(
          `Another customer with mobile "${input.mobileNumber}" already exists (${duplicateMobile.name}).`,
          409
        );
      }
    }

    const updated = await this.repo.update(businessId, customerId, input);

    const balances = await this.repo.calculateCustomerBalances(businessId, [customerId]);
    const dynamicDue = balances.get(customerId) ?? 0;

    return this.formatCustomer(updated, dynamicDue);
  }

  /**
   * Delete or soft-delete customer
   * If customer has financial transactions, soft deletes (isActive: false)
   * If no transactions exist, performs permanent database deletion
   */
  async deleteCustomer(businessId: string, customerId: string) {
    await this.validateBusiness(businessId);

    const existing = await this.repo.findById(businessId, customerId);
    if (!existing) {
      throw new ErrorResponse("Customer not found to delete.", 404);
    }

    const counts = (existing as any)._count || {
      invoices: 0,
      receipts: 0,
      ledgerEntries: 0,
      creditNotes: 0,
    };

    const hasRealTransactions =
      counts.invoices > 0 || counts.receipts > 0 || counts.creditNotes > 0;

    if (hasRealTransactions) {
      // Soft-delete to preserve accounting integrity & audit trails
      await this.repo.softDelete(businessId, customerId);
      return {
        isSoftDeleted: true,
        message: `Customer has active billing transaction records. Customer profile has been deactivated.`,
      };
    }

    // Clean up opening balance ledger entries if no invoices or receipts exist
    await prisma.ledgerEntry.deleteMany({
      where: {
        businessId,
        customerId,
      },
    });

    // Safe to hard delete
    await this.repo.delete(businessId, customerId);
    return {
      isSoftDeleted: false,
      message: "Customer deleted successfully.",
    };

  }

  /**
   * Aggregate metrics for customer directory
   */
  async getMetrics(businessId: string) {
    await this.validateBusiness(businessId);
    return this.repo.getMetrics(businessId);
  }
}

export const customerService = new CustomerService();
