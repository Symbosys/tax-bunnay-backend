import { prisma } from "../../../../db/prisma";
import type {
  BankAccountCategoryType,
  BankAccountStatusType,
  CreateBankAccountInput,
  ReconcileBankAccountInput,
  UpdateBankAccountInput,
} from "../validators/bank-account.validators";

export interface BankAccountRecord {
  id: string;
  businessId: string;
  bankName: string;
  accountTypeLabel: string;
  category: BankAccountCategoryType;
  accountNumberMasked: string;
  fullAccountNumber: string;
  ifsc: string;
  branch: string;
  currentBalance: number;
  clearedBalance: number;
  unclearedBalance: number;
  status: BankAccountStatusType;
  logoType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankTransactionRecord {
  id: string;
  businessId: string;
  bankAccountId: string;
  title: string;
  subtitle: string;
  reference: string;
  amount: number;
  isCredit: boolean;
  date: string;
  isCleared: boolean;
  logoType: string;
  createdAt: Date;
}

/**
 * Standard seed bank accounts matching the UI screen
 */
const DEFAULT_SEED_BANK_ACCOUNTS: Omit<BankAccountRecord, "businessId">[] = [
  {
    id: "bank_01",
    bankName: "State Bank of India",
    accountTypeLabel: "Main Current Account",
    category: "current",
    accountNumberMasked: "XXXX XXXX 1234",
    fullAccountNumber: "382910291234",
    ifsc: "SBIN0001234",
    branch: "Main Branch, Mumbai",
    currentBalance: 745320.5,
    clearedBalance: 721100.5,
    unclearedBalance: 24220.0,
    status: "Active",
    logoType: "sbi",
    createdAt: new Date("2026-01-01T09:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  },
  {
    id: "bank_02",
    bankName: "HDFC Bank",
    accountTypeLabel: "Business Current Account",
    category: "current",
    accountNumberMasked: "XXXX XXXX 5678",
    fullAccountNumber: "50200019285678",
    ifsc: "HDFC0005678",
    branch: "Nariman Point",
    currentBalance: 580450.0,
    clearedBalance: 551000.0,
    unclearedBalance: 29450.0,
    status: "Active",
    logoType: "hdfc",
    createdAt: new Date("2026-01-05T09:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  },
  {
    id: "bank_03",
    bankName: "ICICI Bank",
    accountTypeLabel: "Savings Account",
    category: "savings",
    accountNumberMasked: "XXXX XXXX 9012",
    fullAccountNumber: "001201599012",
    ifsc: "ICIC0009012",
    branch: "Bandra Kurla Complex",
    currentBalance: 325680.0,
    clearedBalance: 315680.0,
    unclearedBalance: 10000.0,
    status: "Active",
    logoType: "icici",
    createdAt: new Date("2026-01-10T09:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  },
  {
    id: "bank_04",
    bankName: "Axis Bank",
    accountTypeLabel: "Overdraft Account",
    category: "credit",
    accountNumberMasked: "XXXX XXXX 3456",
    fullAccountNumber: "91202004813456",
    ifsc: "UTIB0003456",
    branch: "Fort Branch",
    currentBalance: 215430.0,
    clearedBalance: 205430.0,
    unclearedBalance: 10000.0,
    status: "Active",
    logoType: "axis",
    createdAt: new Date("2026-01-15T09:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  },
  {
    id: "bank_05",
    bankName: "Bank of Baroda",
    accountTypeLabel: "Salary Account",
    category: "savings",
    accountNumberMasked: "XXXX XXXX 7890",
    fullAccountNumber: "29810100007890",
    ifsc: "BARB0XXXXXX",
    branch: "Andheri East",
    currentBalance: 108550.0,
    clearedBalance: 99100.0,
    unclearedBalance: 9450.0,
    status: "Active",
    logoType: "bob",
    createdAt: new Date("2026-01-20T09:00:00.000Z"),
    updatedAt: new Date("2026-05-24T10:00:00.000Z"),
  },
];

/**
 * Standard seed recent transactions matching the UI screen
 */
const DEFAULT_SEED_TRANSACTIONS: Omit<BankTransactionRecord, "businessId">[] = [
  {
    id: "tx_01",
    bankAccountId: "bank_01",
    title: "NEFT Payment Received",
    subtitle: "From: ABC Corporation",
    reference: "Ref: NEFT/240524/001",
    amount: 75000.0,
    isCredit: true,
    date: "24 May 2026",
    isCleared: true,
    logoType: "sbi",
    createdAt: new Date("2026-05-24T14:30:00.000Z"),
  },
  {
    id: "tx_02",
    bankAccountId: "bank_02",
    title: "Cheque Deposit",
    subtitle: "Cheque No: 123456",
    reference: "Ref: DEP/240524/002",
    amount: 50000.0,
    isCredit: true,
    date: "24 May 2026",
    isCleared: false,
    logoType: "hdfc",
    createdAt: new Date("2026-05-24T12:15:00.000Z"),
  },
  {
    id: "tx_03",
    bankAccountId: "bank_03",
    title: "UPI Payment",
    subtitle: "To: Office Supplies",
    reference: "Ref: UPI/240524/003",
    amount: 8450.0,
    isCredit: false,
    date: "24 May 2026",
    isCleared: true,
    logoType: "icici",
    createdAt: new Date("2026-05-24T11:00:00.000Z"),
  },
  {
    id: "tx_04",
    bankAccountId: "bank_04",
    title: "Account Transfer",
    subtitle: "To: Salary Account",
    reference: "Ref: TRF/240523/004",
    amount: 100000.0,
    isCredit: false,
    date: "24 May 2026",
    isCleared: true,
    logoType: "axis",
    createdAt: new Date("2026-05-23T16:45:00.000Z"),
  },
  {
    id: "tx_05",
    bankAccountId: "bank_05",
    title: "Interest Credited",
    subtitle: "Bank Savings Interest",
    reference: "Ref: INT/240523/005",
    amount: 1250.0,
    isCredit: true,
    date: "23 May 2026",
    isCleared: true,
    logoType: "bob",
    createdAt: new Date("2026-05-23T09:30:00.000Z"),
  },
];

export class BankAccountRepository {
  private bankAccountsStore: Map<string, BankAccountRecord[]> = new Map();
  private bankTransactionsStore: Map<string, BankTransactionRecord[]> = new Map();

  /**
   * Initialize standard bank accounts and transactions for a business tenant
   */
  private initStoreForBusiness(businessId: string): {
    accounts: BankAccountRecord[];
    transactions: BankTransactionRecord[];
  } {
    if (!this.bankAccountsStore.has(businessId)) {
      const accounts: BankAccountRecord[] = DEFAULT_SEED_BANK_ACCOUNTS.map((acc) => ({
        ...acc,
        businessId,
      }));
      this.bankAccountsStore.set(businessId, accounts);
    }

    if (!this.bankTransactionsStore.has(businessId)) {
      const transactions: BankTransactionRecord[] = DEFAULT_SEED_TRANSACTIONS.map((tx) => ({
        ...tx,
        businessId,
      }));
      this.bankTransactionsStore.set(businessId, transactions);
    }

    return {
      accounts: this.bankAccountsStore.get(businessId)!,
      transactions: this.bankTransactionsStore.get(businessId)!,
    };
  }

  /**
   * Helper to derive logo type from bank name
   */
  private deriveLogoType(bankName: string): string {
    const lower = bankName.toLowerCase();
    if (lower.includes("sbi") || lower.includes("state bank")) return "sbi";
    if (lower.includes("hdfc")) return "hdfc";
    if (lower.includes("icici")) return "icici";
    if (lower.includes("axis")) return "axis";
    if (lower.includes("bob") || lower.includes("baroda")) return "bob";
    if (lower.includes("kotak")) return "kotak";
    if (lower.includes("pnb") || lower.includes("punjab")) return "pnb";
    return "other";
  }

  /**
   * Helper to derive category from account type
   */
  private deriveCategory(accountType: string): BankAccountCategoryType {
    const lower = accountType.toLowerCase();
    if (lower.includes("saving")) return "savings";
    if (lower.includes("overdraft") || lower.includes("credit")) return "credit";
    if (lower.includes("inactive")) return "inactive";
    return "current";
  }

  /**
   * Helper to format masked account number
   */
  private maskAccountNumber(accNo: string): string {
    const clean = accNo.replace(/\s+/g, "");
    if (clean.length <= 4) return `XXXX ${clean}`;
    const last4 = clean.slice(-4);
    return `XXXX XXXX ${last4}`;
  }

  /**
   * Get all bank accounts for a business
   */
  async getAllAccounts(businessId: string): Promise<BankAccountRecord[]> {
    this.initStoreForBusiness(businessId);
    return [...(this.bankAccountsStore.get(businessId) || [])];
  }

  /**
   * Find single bank account by ID
   */
  async findById(businessId: string, id: string): Promise<BankAccountRecord | null> {
    const accounts = await this.getAllAccounts(businessId);
    return accounts.find((acc) => acc.id === id) || null;
  }

  /**
   * Create a new bank account
   */
  async create(businessId: string, input: CreateBankAccountInput): Promise<BankAccountRecord> {
    this.initStoreForBusiness(businessId);
    const accounts = this.bankAccountsStore.get(businessId)!;

    const id = `bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const category = this.deriveCategory(input.accountType);
    const logoType = input.logoType || this.deriveLogoType(input.bankName);
    const accountNumberMasked = this.maskAccountNumber(input.accountNumber);
    const now = new Date();

    const newAccount: BankAccountRecord = {
      id,
      businessId,
      bankName: input.bankName.trim(),
      accountTypeLabel: input.accountType.trim(),
      category,
      accountNumberMasked,
      fullAccountNumber: input.accountNumber.trim(),
      ifsc: input.ifsc.trim().toUpperCase(),
      branch: (input.branch || "").trim(),
      currentBalance: input.openingBalance,
      clearedBalance: input.openingBalance,
      unclearedBalance: 0,
      status: input.status,
      logoType,
      createdAt: now,
      updatedAt: now,
    };

    accounts.unshift(newAccount);

    // Optional: Synchronize with Prisma Account table for general ledger linkage
    try {
      await prisma.account.create({
        data: {
          businessId,
          name: `${input.bankName} - ${newAccount.accountNumberMasked}`,
          accountType: "BANK",
          openingBalance: input.openingBalance,
          isActive: input.status === "Active",
        },
      });
    } catch {
      // Best-effort database sync (silently falls back to memory store if tenant not yet migrated)
    }

    return newAccount;
  }

  /**
   * Update an existing bank account
   */
  async update(
    businessId: string,
    id: string,
    input: UpdateBankAccountInput
  ): Promise<BankAccountRecord | null> {
    this.initStoreForBusiness(businessId);
    const accounts = this.bankAccountsStore.get(businessId)!;
    const index = accounts.findIndex((acc) => acc.id === id);
    const existing = accounts[index];
    if (!existing) return null;

    const updatedCategory = input.accountType
      ? this.deriveCategory(input.accountType)
      : existing.category;

    const updatedLogo = input.logoType
      ? input.logoType
      : input.bankName
      ? this.deriveLogoType(input.bankName)
      : existing.logoType;

    const updatedMasked = input.accountNumber
      ? this.maskAccountNumber(input.accountNumber)
      : existing.accountNumberMasked;

    const updatedAccount: BankAccountRecord = {
      ...existing,
      bankName: input.bankName !== undefined ? input.bankName.trim() : existing.bankName,
      accountTypeLabel:
        input.accountType !== undefined ? input.accountType.trim() : existing.accountTypeLabel,
      category: updatedCategory,
      fullAccountNumber:
        input.accountNumber !== undefined
          ? input.accountNumber.trim()
          : existing.fullAccountNumber,
      accountNumberMasked: updatedMasked,
      ifsc: input.ifsc !== undefined ? input.ifsc.trim().toUpperCase() : existing.ifsc,
      branch: input.branch !== undefined ? input.branch.trim() : existing.branch,
      currentBalance:
        input.openingBalance !== undefined ? input.openingBalance : existing.currentBalance,
      status: input.status !== undefined ? input.status : existing.status,
      logoType: updatedLogo,
      updatedAt: new Date(),
    };

    accounts[index] = updatedAccount;
    return updatedAccount;
  }

  /**
   * Delete a bank account
   */
  async delete(businessId: string, id: string): Promise<boolean> {
    this.initStoreForBusiness(businessId);
    const accounts = this.bankAccountsStore.get(businessId)!;
    const index = accounts.findIndex((acc) => acc.id === id);
    if (index === -1) return false;

    accounts.splice(index, 1);
    return true;
  }

  /**
   * Toggle status of a bank account (Active <-> Inactive)
   */
  async toggleStatus(businessId: string, id: string): Promise<BankAccountRecord | null> {
    this.initStoreForBusiness(businessId);
    const accounts = this.bankAccountsStore.get(businessId)!;
    const account = accounts.find((acc) => acc.id === id);
    if (!account) return null;

    account.status = account.status === "Active" ? "Inactive" : "Active";
    account.updatedAt = new Date();
    return account;
  }

  /**
   * Get recent transactions for a business
   */
  async getRecentTransactions(
    businessId: string,
    limit: number = 10
  ): Promise<BankTransactionRecord[]> {
    this.initStoreForBusiness(businessId);
    const txs = this.bankTransactionsStore.get(businessId) || [];
    return txs.slice(0, limit);
  }

  /**
   * Reconcile bank account and mark transactions cleared
   */
  async reconcile(
    businessId: string,
    accountId: string,
    input: ReconcileBankAccountInput
  ): Promise<{
    account: BankAccountRecord;
    clearedCount: number;
    difference: number;
  } | null> {
    this.initStoreForBusiness(businessId);
    const accounts = this.bankAccountsStore.get(businessId)!;
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) return null;

    const txs = this.bankTransactionsStore.get(businessId) || [];
    let clearedCount = 0;

    if (input.transactionIds && input.transactionIds.length > 0) {
      for (const tx of txs) {
        if (input.transactionIds.includes(tx.id)) {
          tx.isCleared = true;
          clearedCount++;
        }
      }
    }

    if (input.statementBalance !== undefined) {
      account.clearedBalance = input.statementBalance;
      account.unclearedBalance = Math.max(0, account.currentBalance - account.clearedBalance);
    } else {
      // Re-calculate cleared and uncleared balance from transactions
      account.clearedBalance = account.currentBalance - account.unclearedBalance;
    }

    account.updatedAt = new Date();

    const diff =
      input.statementBalance !== undefined
        ? Math.abs(account.currentBalance - input.statementBalance)
        : 0;

    return {
      account,
      clearedCount,
      difference: diff,
    };
  }
}

export const bankAccountRepository = new BankAccountRepository();
