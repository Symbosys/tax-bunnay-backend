import type {
  BankAccountRecord,
  BankTransactionRecord,
} from "../repo/bank-account.repo";
import {
  bankAccountRepository,
  BankAccountRepository,
} from "../repo/bank-account.repo";
import type {
  BankAccountQueryInput,
  CreateBankAccountInput,
  ExportBankQueryInput,
  ReconcileBankAccountInput,
  UpdateBankAccountInput,
} from "../validators/bank-account.validators";

export interface BankShareSegment {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface BankAccountSummaryResult {
  totalAccounts: number;
  totalBalance: number;
  clearedBalance: number;
  unclearedBalance: number;
  displayedAccounts: BankAccountRecord[];
  recentTransactions: BankTransactionRecord[];
  balanceOverview: BankShareSegment[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
  limit: number;
}

const DEFAULT_SEGMENT_COLORS = [
  "#2563EB", // Blue
  "#0284C7", // Light Blue
  "#EA580C", // Orange
  "#9333EA", // Purple
  "#16A34A", // Green
  "#0D9488", // Teal
  "#E11D48", // Rose
];

export class BankAccountService {
  private repo: BankAccountRepository;

  constructor(repo: BankAccountRepository = bankAccountRepository) {
    this.repo = repo;
  }

  /**
   * Get all bank accounts with KPI metrics, category filtering, search, pagination,
   * recent transactions and donut chart distribution
   */
  async getBankAccounts(
    businessId: string,
    query: BankAccountQueryInput
  ): Promise<BankAccountSummaryResult> {
    const allAccounts = await this.repo.getAllAccounts(businessId);
    const recentTransactions = await this.repo.getRecentTransactions(businessId, 10);

    // 1. Calculate overall KPI metrics for Active accounts
    const activeAccounts = allAccounts.filter((a) => a.status === "Active");
    const totalAccounts = activeAccounts.length;
    const totalBalance = activeAccounts.reduce((acc, a) => acc + a.currentBalance, 0);
    const clearedBalance = activeAccounts.reduce((acc, a) => acc + a.clearedBalance, 0);
    const unclearedBalance = activeAccounts.reduce((acc, a) => acc + a.unclearedBalance, 0);

    // 2. Compute Donut Chart Balance Distribution segments
    const balanceOverview: BankShareSegment[] = activeAccounts.map((a, index) => {
      const percentage =
        totalBalance > 0
          ? parseFloat(((a.currentBalance / totalBalance) * 100).toFixed(1))
          : 0;
      return {
        name: a.bankName,
        amount: a.currentBalance,
        percentage,
        color: DEFAULT_SEGMENT_COLORS[index % DEFAULT_SEGMENT_COLORS.length] || "#2563EB",
      };
    });

    // 3. Filter accounts based on Tab and Query parameters
    let filtered = [...allAccounts];

    // Normalize tab / category
    const selectedTab = (query.tab || query.category || "").toLowerCase().trim();

    if (
      selectedTab === "current accounts" ||
      selectedTab === "current"
    ) {
      filtered = filtered.filter((a) => a.category === "current");
    } else if (
      selectedTab === "savings accounts" ||
      selectedTab === "savings"
    ) {
      filtered = filtered.filter((a) => a.category === "savings");
    } else if (
      selectedTab === "credit accounts" ||
      selectedTab === "credit"
    ) {
      filtered = filtered.filter((a) => a.category === "credit");
    } else if (
      selectedTab === "inactive accounts" ||
      selectedTab === "inactive"
    ) {
      filtered = filtered.filter((a) => a.status !== "Active" || a.category === "inactive");
    }

    // Status filter
    if (query.status && query.status !== "all") {
      filtered = filtered.filter(
        (a) => a.status.toLowerCase() === query.status!.toLowerCase()
      );
    }

    // Full-text search across bank name, account number, masked number, IFSC, branch
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim().toLowerCase();
      filtered = filtered.filter((a) => {
        return (
          a.bankName.toLowerCase().includes(q) ||
          a.accountTypeLabel.toLowerCase().includes(q) ||
          a.accountNumberMasked.toLowerCase().includes(q) ||
          a.fullAccountNumber.toLowerCase().includes(q) ||
          a.ifsc.toLowerCase().includes(q) ||
          a.branch.toLowerCase().includes(q)
        );
      });
    }

    // 4. Sort accounts
    const sortBy = query.sortBy || "balance_desc";
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "balance_asc":
        case "Balance (Low to High)":
          return a.currentBalance - b.currentBalance;
        case "name_asc":
        case "Name (A to Z)":
          return a.bankName.localeCompare(b.bankName);
        case "name_desc":
        case "Name (Z to A)":
          return b.bankName.localeCompare(a.bankName);
        case "balance_desc":
        case "Balance (High to Low)":
        default:
          return b.currentBalance - a.currentBalance;
      }
    });

    // 5. Pagination
    const totalCount = filtered.length;
    const page = query.page || 1;
    const limit = query.limit || 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const displayedAccounts = filtered.slice(startIndex, startIndex + limit);

    return {
      totalAccounts,
      totalBalance: parseFloat(totalBalance.toFixed(2)),
      clearedBalance: parseFloat(clearedBalance.toFixed(2)),
      unclearedBalance: parseFloat(unclearedBalance.toFixed(2)),
      displayedAccounts,
      recentTransactions,
      balanceOverview,
      totalPages,
      currentPage: page,
      totalCount,
      limit,
    };
  }

  /**
   * Get single bank account detail by ID
   */
  async getAccountDetail(
    businessId: string,
    id: string
  ): Promise<BankAccountRecord | null> {
    return this.repo.findById(businessId, id);
  }

  /**
   * Create a new bank account
   */
  async createBankAccount(
    businessId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccountRecord> {
    return this.repo.create(businessId, input);
  }

  /**
   * Update an existing bank account
   */
  async updateBankAccount(
    businessId: string,
    id: string,
    input: UpdateBankAccountInput
  ): Promise<BankAccountRecord | null> {
    return this.repo.update(businessId, id, input);
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(businessId: string, id: string): Promise<boolean> {
    return this.repo.delete(businessId, id);
  }

  /**
   * Toggle Active / Inactive status of a bank account
   */
  async toggleStatus(
    businessId: string,
    id: string
  ): Promise<BankAccountRecord | null> {
    return this.repo.toggleStatus(businessId, id);
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(
    businessId: string,
    limit: number = 10
  ): Promise<BankTransactionRecord[]> {
    return this.repo.getRecentTransactions(businessId, limit);
  }

  /**
   * Reconcile bank account
   */
  async reconcileAccount(
    businessId: string,
    id: string,
    input: ReconcileBankAccountInput
  ): Promise<{
    account: BankAccountRecord;
    clearedCount: number;
    difference: number;
  } | null> {
    return this.repo.reconcile(businessId, id, input);
  }

  /**
   * Export bank accounts to CSV
   */
  async exportBankAccounts(
    businessId: string,
    query: ExportBankQueryInput
  ): Promise<{ filename: string; csv: string }> {
    const summary = await this.getBankAccounts(businessId, {
      tab: query.tab,
      search: query.search,
      page: 1,
      limit: 1000,
    });

    const headers = [
      "Bank Name",
      "Account Type",
      "Account Number",
      "IFSC Code",
      "Branch",
      "Current Balance",
      "Cleared Balance",
      "Uncleared Balance",
      "Status",
    ];

    const rows = summary.displayedAccounts.map((acc) => [
      `"${acc.bankName}"`,
      `"${acc.accountTypeLabel}"`,
      `"${acc.accountNumberMasked}"`,
      `"${acc.ifsc}"`,
      `"${acc.branch}"`,
      acc.currentBalance.toFixed(2),
      acc.clearedBalance.toFixed(2),
      acc.unclearedBalance.toFixed(2),
      `"${acc.status}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const filename = `bank_accounts_${Date.now()}.csv`;

    return {
      filename,
      csv: csvContent,
    };
  }
}

export const bankAccountService = new BankAccountService();

