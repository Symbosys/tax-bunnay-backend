import { prisma } from "../../../../db/prisma";
import type {
  AccountCategoryType,
  CreateChartAccountInput,
  UpdateChartAccountInput,
} from "../validators/chart-account.validators";

export interface AccountRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  type: AccountCategoryType;
  balance: number;
  isGroup: boolean;
  parentCode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Standard seed accounts matching the Flutter Chart of Accounts screen
 */
const DEFAULT_SEED_ACCOUNTS: AccountRecord[] = [
  // --- 1000 ASSETS ---
  {
    id: "grp_1000",
    code: "1000",
    name: "1. Assets",
    description: "All asset related accounts",
    type: "asset",
    balance: 635400.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_1001",
    code: "1001",
    name: "1.1 Cash in Hand",
    description: "Physical cash available in drawer",
    type: "asset",
    balance: 12750.0,
    isGroup: false,
    parentCode: "1000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_1002",
    code: "1002",
    name: "1.2 Bank Accounts",
    description: "HDFC & ICICI Current Accounts",
    type: "asset",
    balance: 580000.0,
    isGroup: false,
    parentCode: "1000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_1003",
    code: "1003",
    name: "1.3 Accounts Receivable",
    description: "Outstanding invoices from customers",
    type: "asset",
    balance: 42650.0,
    isGroup: false,
    parentCode: "1000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  // --- 2000 LIABILITIES ---
  {
    id: "grp_2000",
    code: "2000",
    name: "2. Liabilities",
    description: "All liability related accounts",
    type: "liability",
    balance: 215200.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_2001",
    code: "2001",
    name: "2.1 Accounts Payable",
    description: "Bills due to suppliers & vendors",
    type: "liability",
    balance: 125200.0,
    isGroup: false,
    parentCode: "2000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_2002",
    code: "2002",
    name: "2.2 Short Term Loans",
    description: "Working capital credit facility",
    type: "liability",
    balance: 90000.0,
    isGroup: false,
    parentCode: "2000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  // --- 3000 EQUITY ---
  {
    id: "grp_3000",
    code: "3000",
    name: "3. Equity",
    description: "Owner's equity accounts",
    type: "equity",
    balance: 325000.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_3001",
    code: "3001",
    name: "3.1 Owner's Capital",
    description: "Initial business investment capital",
    type: "equity",
    balance: 250000.0,
    isGroup: false,
    parentCode: "3000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_3002",
    code: "3002",
    name: "3.2 Retained Earnings",
    description: "Accumulated profits retained",
    type: "equity",
    balance: 75000.0,
    isGroup: false,
    parentCode: "3000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  // --- 4000 INCOME ---
  {
    id: "grp_4000",
    code: "4000",
    name: "4. Income",
    description: "All income accounts",
    type: "income",
    balance: 875000.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_4001",
    code: "4001",
    name: "4.1 Sales Revenue",
    description: "Primary product sales revenue",
    type: "income",
    balance: 825000.0,
    isGroup: false,
    parentCode: "4000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_4002",
    code: "4002",
    name: "4.2 Service Income",
    description: "Consulting & installation charges",
    type: "income",
    balance: 50000.0,
    isGroup: false,
    parentCode: "4000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  // --- 5000 EXPENSES ---
  {
    id: "grp_5000",
    code: "5000",
    name: "5. Expenses",
    description: "All expense accounts",
    type: "expense",
    balance: 412300.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_5001",
    code: "5001",
    name: "5.1 Salaries & Wages",
    description: "Employee payroll & bonuses",
    type: "expense",
    balance: 250000.0,
    isGroup: false,
    parentCode: "5000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_5002",
    code: "5002",
    name: "5.2 Rent & Utilities",
    description: "Office rent, electricity & internet",
    type: "expense",
    balance: 162300.0,
    isGroup: false,
    parentCode: "5000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },

  // --- 6000 OTHER INCOME ---
  {
    id: "grp_6000",
    code: "6000",
    name: "6. Other Income",
    description: "Other income accounts",
    type: "income",
    balance: 25000.0,
    isGroup: true,
    parentCode: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "acc_6001",
    code: "6001",
    name: "6.1 Interest Income",
    description: "Bank FD & savings interest",
    type: "income",
    balance: 25000.0,
    isGroup: false,
    parentCode: "6000",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

// In-memory overlay per businessId to store created/updated accounts dynamically
const tenantAccountsStore = new Map<string, AccountRecord[]>();

export class ChartAccountRepository {
  /**
   * Helper to map Prisma AccountType to standard CategoryType
   */
  private mapPrismaType(accountType: string): AccountCategoryType {
    switch (accountType.toUpperCase()) {
      case "CASH":
      case "BANK":
      case "CUSTOMER":
      case "INPUT_GST":
        return "asset";
      case "SUPPLIER":
      case "OUTPUT_GST":
        return "liability";
      case "INCOME":
      case "SALES":
        return "income";
      case "EXPENSE":
      case "PURCHASE":
        return "expense";
      default:
        return "asset";
    }
  }

  /**
   * Helper to map CategoryType to Prisma AccountType
   */
  private mapCategoryToPrismaType(category: AccountCategoryType): any {
    switch (category) {
      case "asset":
        return "BANK";
      case "liability":
        return "SUPPLIER";
      case "income":
        return "INCOME";
      case "expense":
        return "EXPENSE";
      case "equity":
        return "OTHER";
    }
  }

  /**
   * 1. Get all raw accounts for a business (combines Prisma accounts + standard seeded hierarchy)
   */
  async getAccounts(businessId: string): Promise<AccountRecord[]> {
    // Check if tenant has cached/modified in-memory overlay
    if (!tenantAccountsStore.has(businessId)) {
      // Clone default seed accounts
      const initial = DEFAULT_SEED_ACCOUNTS.map((acc) => ({ ...acc }));
      tenantAccountsStore.set(businessId, initial);
    }

    const currentRecords = tenantAccountsStore.get(businessId) || [];

    // Attempt to enrich with Prisma database records
    try {
      const dbAccounts = await prisma.account.findMany({
        where: { businessId },
        include: {
          journalLines: {
            select: {
              debitAmount: true,
              creditAmount: true,
            },
          },
        },
      });

      if (dbAccounts && dbAccounts.length > 0) {
        for (const dbAcc of dbAccounts) {
          // Check if already in currentRecords by id or name
          const exists = currentRecords.find(
            (r) => r.id === dbAcc.id || r.name.toLowerCase() === dbAcc.name.toLowerCase()
          );

          // Calculate current balance = openingBalance + debits - credits
          let netBalance = Number(dbAcc.openingBalance) || 0;
          const category = this.mapPrismaType(dbAcc.accountType);

          for (const jl of dbAcc.journalLines) {
            const deb = Number(jl.debitAmount) || 0;
            const cred = Number(jl.creditAmount) || 0;
            if (category === "asset" || category === "expense") {
              netBalance += deb - cred;
            } else {
              netBalance += cred - deb;
            }
          }

          if (exists) {
            exists.balance = netBalance;
            exists.isActive = dbAcc.isActive;
          } else {
            // Infer parentCode based on category
            const parentCode =
              category === "asset"
                ? "1000"
                : category === "liability"
                ? "2000"
                : category === "equity"
                ? "3000"
                : category === "income"
                ? "4000"
                : "5000";

            currentRecords.push({
              id: dbAcc.id,
              code: `acc_${dbAcc.id.slice(-4)}`,
              name: dbAcc.name,
              description: `${dbAcc.accountType} account`,
              type: category,
              balance: netBalance,
              isGroup: false,
              parentCode,
              isActive: dbAcc.isActive,
              createdAt: dbAcc.createdAt,
              updatedAt: dbAcc.updatedAt,
            });
          }
        }
      }
    } catch (_) {
      // Prisma error or disconnected; gracefully use tenantAccountsStore
    }

    return currentRecords;
  }

  /**
   * 2. Find single account by ID or Code
   */
  async getAccountById(businessId: string, idOrCode: string): Promise<AccountRecord | null> {
    const accounts = await this.getAccounts(businessId);
    return (
      accounts.find((a) => a.id === idOrCode || a.code.toLowerCase() === idOrCode.toLowerCase()) ||
      null
    );
  }

  /**
   * 3. Create a new Chart of Account
   */
  async createAccount(
    businessId: string,
    input: CreateChartAccountInput
  ): Promise<AccountRecord> {
    const accounts = await this.getAccounts(businessId);

    // Generate unique ID
    const newId = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newRecord: AccountRecord = {
      id: newId,
      code: input.code,
      name: input.name,
      description: input.description || "",
      type: input.type,
      balance: input.openingBalance || 0.0,
      isGroup: input.isGroup || false,
      parentCode: input.parentCode || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Attempt to persist to Prisma if it's a posting account
    try {
      if (!input.isGroup) {
        const createdDb = await prisma.account.create({
          data: {
            id: newId,
            businessId,
            name: input.name,
            accountType: this.mapCategoryToPrismaType(input.type),
            openingBalance: input.openingBalance || 0,
            isActive: true,
          },
        });
        newRecord.id = createdDb.id;
      }
    } catch (_) {}

    accounts.push(newRecord);
    tenantAccountsStore.set(businessId, accounts);
    return newRecord;
  }

  /**
   * 4. Update an existing Account
   */
  async updateAccount(
    businessId: string,
    id: string,
    input: UpdateChartAccountInput
  ): Promise<AccountRecord | null> {
    const accounts = await this.getAccounts(businessId);
    const index = accounts.findIndex((a) => a.id === id || a.code === id);
    if (index === -1) return null;

    const existing = accounts[index];
    if (!existing) return null;

    const updated: AccountRecord = {
      ...existing,
      name: input.name ?? existing.name,
      code: input.code ?? existing.code,
      type: input.type ?? existing.type,
      parentCode: input.parentCode !== undefined ? input.parentCode : existing.parentCode,
      balance: input.openingBalance !== undefined ? input.openingBalance : existing.balance,
      description: input.description ?? existing.description,
      isGroup: input.isGroup !== undefined ? input.isGroup : existing.isGroup,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: new Date(),
    };

    // Attempt to update in Prisma
    try {
      await prisma.account.update({
        where: { id: existing.id },
        data: {
          name: updated.name,
          isActive: updated.isActive,
          openingBalance: updated.balance,
        },
      });
    } catch (_) {}

    accounts[index] = updated;
    tenantAccountsStore.set(businessId, accounts);
    return updated;
  }

  /**
   * 5. Delete or Deactivate an Account
   */
  async deleteAccount(businessId: string, id: string): Promise<boolean> {
    const accounts = await this.getAccounts(businessId);
    const index = accounts.findIndex((a) => a.id === id || a.code === id);
    if (index === -1) return false;

    const target = accounts[index];
    if (!target) return false;

    // Attempt deletion from Prisma
    try {
      await prisma.account.delete({
        where: { id: target.id },
      });
    } catch (_) {}

    accounts.splice(index, 1);
    tenantAccountsStore.set(businessId, accounts);
    return true;
  }
}

export const chartAccountRepo = new ChartAccountRepository();
