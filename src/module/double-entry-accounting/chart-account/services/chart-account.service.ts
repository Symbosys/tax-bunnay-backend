import { ErrorResponse } from "../../../../utils/response.util";
import {
  chartAccountRepo,
  ChartAccountRepository,
  type AccountRecord,
} from "../repo/chart-account.repo";
import type {
  AccountCategoryType,
  ChartAccountQueryParams,
  CreateChartAccountInput,
  UpdateChartAccountInput,
} from "../validators/chart-account.validators";

export interface CoaAccountItemResponse {
  id: string;
  code: string;
  name: string;
  description: string;
  type: AccountCategoryType;
  balance: number;
  isGroup: boolean;
  parentCode: string | null;
  isActive: boolean;
  children: CoaAccountItemResponse[];
}

export interface CoaSummaryDataResponse {
  totalAccounts: number;
  groups: number;
  ledgerAccounts: number;
  totalBalance: number;
  displayedGroups: CoaAccountItemResponse[];
}

export class ChartAccountService {
  private repo: ChartAccountRepository;

  constructor(repo: ChartAccountRepository = chartAccountRepo) {
    this.repo = repo;
  }

  /**
   * Helper to build nested parent-child tree from flat account records
   */
  private buildTree(records: AccountRecord[]): CoaAccountItemResponse[] {
    const map = new Map<string, CoaAccountItemResponse>();

    // 1. Initialize all nodes with empty children array
    for (const r of records) {
      map.set(r.code, {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        type: r.type,
        balance: r.balance,
        isGroup: r.isGroup,
        parentCode: r.parentCode,
        isActive: r.isActive,
        children: [],
      });
    }

    const roots: CoaAccountItemResponse[] = [];

    // 2. Attach children to parents or collect roots
    for (const r of records) {
      const node = map.get(r.code)!;
      if (r.parentCode && map.has(r.parentCode) && r.parentCode !== r.code) {
        map.get(r.parentCode)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 3. For any group whose balance is 0 or needs to reflect children's balance sum, compute aggregate
    for (const root of roots) {
      if (root.isGroup && root.children.length > 0) {
        const childrenSum = root.children.reduce((sum, c) => sum + c.balance, 0);
        if (root.balance === 0 || childrenSum > root.balance) {
          root.balance = childrenSum;
        }
      }
    }

    return roots;
  }

  /**
   * 1. Get Chart of Accounts with hierarchical tree and 4 KPI metric cards
   */
  async getChartOfAccounts(
    businessId: string,
    query: ChartAccountQueryParams
  ): Promise<CoaSummaryDataResponse> {
    const allRecords = await this.repo.getAccounts(businessId);

    // Compute overall KPI metrics
    let groupCount = 0;
    let ledgerCount = 0;
    let totalBalanceSum = 0;

    for (const r of allRecords) {
      if (r.isGroup) {
        groupCount++;
      } else {
        ledgerCount++;
        totalBalanceSum += r.balance;
      }
    }

    const totalAccounts = allRecords.length;

    // Build hierarchical tree
    let tree = this.buildTree(allRecords);

    // Filter by Category tab
    if (query.category && query.category !== "All Accounts") {
      const cat = query.category.toLowerCase();
      tree = tree.filter((g) => {
        if (cat === "assets" || cat === "asset") return g.type === "asset";
        if (cat === "liabilities" || cat === "liability") return g.type === "liability";
        if (cat === "equity") return g.type === "equity";
        if (cat === "income") return g.type === "income";
        if (cat === "expenses" || cat === "expense") return g.type === "expense";
        return true;
      });
    }

    // Filter by Search Query
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim().toLowerCase();
      const filtered: CoaAccountItemResponse[] = [];

      for (const group of tree) {
        const groupMatches =
          group.name.toLowerCase().includes(q) ||
          group.code.toLowerCase().includes(q) ||
          group.description.toLowerCase().includes(q);

        const matchedChildren = group.children.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
        );

        if (groupMatches || matchedChildren.length > 0) {
          filtered.push({
            ...group,
            children: matchedChildren.length > 0 ? matchedChildren : group.children,
          });
        }
      }

      tree = filtered;
    }

    // Filter by Zero Balances
    if (query.showZeroBalances === false) {
      tree = tree.map((g) => ({
        ...g,
        children: g.children.filter((c) => Math.abs(c.balance) > 0.001),
      }));
    }

    // Sorting
    const sortBy = query.sortBy || "Code (Ascending)";
    tree.sort((a, b) => {
      if (sortBy === "Code (Descending)") return b.code.localeCompare(a.code);
      if (sortBy === "Name (A-Z)") return a.name.localeCompare(b.name);
      if (sortBy === "Balance (High to Low)") return b.balance - a.balance;
      if (sortBy === "Balance (Low to High)") return a.balance - b.balance;
      // Default: Code (Ascending)
      return a.code.localeCompare(b.code);
    });

    for (const g of tree) {
      g.children.sort((a, b) => {
        if (sortBy === "Code (Descending)") return b.code.localeCompare(a.code);
        if (sortBy === "Name (A-Z)") return a.name.localeCompare(b.name);
        if (sortBy === "Balance (High to Low)") return b.balance - a.balance;
        if (sortBy === "Balance (Low to High)") return a.balance - b.balance;
        return a.code.localeCompare(b.code);
      });
    }

    return {
      totalAccounts,
      groups: groupCount,
      ledgerAccounts: ledgerCount,
      totalBalance: totalBalanceSum,
      displayedGroups: tree,
    };
  }

  /**
   * 2. Get flat list of accounts for dropdowns or selection
   */
  async getFlatAccounts(businessId: string): Promise<AccountRecord[]> {
    return this.repo.getAccounts(businessId);
  }

  /**
   * 3. Get list of parent groups for Add Account dialog
   */
  async getAccountGroups(businessId: string): Promise<AccountRecord[]> {
    const all = await this.repo.getAccounts(businessId);
    return all.filter((a) => a.isGroup);
  }

  /**
   * 4. Get single account by ID or code
   */
  async getAccountDetail(businessId: string, id: string): Promise<AccountRecord> {
    const account = await this.repo.getAccountById(businessId, id);
    if (!account) {
      throw new ErrorResponse(`Account with ID or Code '${id}' not found`, 404);
    }
    return account;
  }

  /**
   * 5. Create a new Chart Account
   */
  async createAccount(
    businessId: string,
    input: CreateChartAccountInput
  ): Promise<AccountRecord> {
    // Check if code already exists
    const existing = await this.repo.getAccountById(businessId, input.code);
    if (existing) {
      throw new ErrorResponse(
        `Account with code '${input.code}' already exists (${existing.name})`,
        400
      );
    }

    // Verify parent exists if provided
    if (input.parentCode && input.parentCode.trim().length > 0) {
      const parent = await this.repo.getAccountById(businessId, input.parentCode);
      if (!parent) {
        throw new ErrorResponse(
          `Parent group with code '${input.parentCode}' does not exist`,
          400
        );
      }
    }

    return this.repo.createAccount(businessId, input);
  }

  /**
   * 6. Update an existing Account
   */
  async updateAccount(
    businessId: string,
    id: string,
    input: UpdateChartAccountInput
  ): Promise<AccountRecord> {
    const updated = await this.repo.updateAccount(businessId, id, input);
    if (!updated) {
      throw new ErrorResponse(`Account with ID '${id}' not found`, 404);
    }
    return updated;
  }

  /**
   * 7. Delete an Account
   */
  async deleteAccount(businessId: string, id: string): Promise<{ success: boolean; message: string }> {
    const account = await this.repo.getAccountById(businessId, id);
    if (!account) {
      throw new ErrorResponse(`Account with ID '${id}' not found`, 404);
    }

    // Check if it's a group with children
    const all = await this.repo.getAccounts(businessId);
    const hasChildren = all.some((a) => a.parentCode === account.code);
    if (hasChildren) {
      throw new ErrorResponse(
        `Cannot delete group '${account.name}' because it contains sub-accounts. Move or delete child accounts first.`,
        400
      );
    }

    await this.repo.deleteAccount(businessId, id);
    return { success: true, message: `Account '${account.name}' deleted successfully` };
  }
}

export const chartAccountService = new ChartAccountService();
