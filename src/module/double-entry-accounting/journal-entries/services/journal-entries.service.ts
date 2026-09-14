import { ErrorResponse } from "../../../../utils/response.util";
import type { RawJournalEntry } from "../repo/journal-entries.repo";
import {
  journalEntriesRepo,
  JournalEntriesRepository,
} from "../repo/journal-entries.repo";
import type {
  CreateJournalEntryInput,
  ExportJournalQueryParams,
  JournalEntriesQueryParams,
  UpdateJournalEntryInput,
} from "../validators/journal-entries.validators";

export interface FormattedJournalItem {
  id: string;
  date: string;
  time: string;
  dateTime: string;
  journalNo: string;
  journalTypeLabel: string;
  type: string;
  reference: string;
  narration: string;
  debit: number;
  credit: number;
  status: string;
  lines: {
    id?: string;
    accountId: string;
    accountName: string;
    accountCode?: string;
    debitAmount: number;
    creditAmount: number;
    narration?: string;
  }[];
}

export interface JournalEntriesResponse {
  totalJournals: number;
  totalDebit: number;
  totalCredit: number;
  outOfBalanceCount: number;
  difference: number;
  isBalanced: boolean;
  pagedItems: FormattedJournalItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export class JournalEntriesService {
  private repo: JournalEntriesRepository;

  constructor(repo: JournalEntriesRepository = journalEntriesRepo) {
    this.repo = repo;
  }

  /**
   * Helper to format Date into Date & Time strings
   */
  private formatDateStrings(dt: Date): { dateStr: string; timeStr: string } {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const day = dt.getDate().toString().padStart(2, "0");
    const month = months[dt.getMonth()];
    const year = dt.getFullYear();
    const dateStr = `${day} ${month} ${year}`;

    let hours = dt.getHours();
    const minutes = dt.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;

    return { dateStr, timeStr };
  }

  /**
   * Capitalize string for UI labels
   */
  private capitalize(s: string): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  /**
   * 1. Get Journal Entries with 4 KPI metrics, smart search, tabs, and pagination
   */
  async getJournalEntries(
    businessId: string,
    query: JournalEntriesQueryParams
  ): Promise<JournalEntriesResponse> {
    const rawEntries = await this.repo.getAllEntries(businessId);

    // 1. Calculate overall KPI metrics for the business
    let totalJournals = rawEntries.length;
    let totalDebit = 0;
    let totalCredit = 0;
    let outOfBalanceCount = 0;

    for (const e of rawEntries) {
      totalDebit += e.totalDebit;
      totalCredit += e.totalCredit;
      if (Math.abs(e.totalDebit - e.totalCredit) > 0.01) {
        outOfBalanceCount += 1;
      }
    }

    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01;

    // 2. Filter by Category Tab
    let filtered = [...rawEntries];

    if (query.tab === "drafts") {
      filtered = filtered.filter((e) => e.status === "draft");
    } else if (query.tab === "recurring") {
      filtered = filtered.filter((e) => e.type === "recurring");
    } else if (query.tab === "templates") {
      filtered = filtered.filter((e) => e.type === "template");
    }

    // 3. Filter by Search Query
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter((e) => {
        const matchesMain =
          e.journalNo.toLowerCase().includes(q) ||
          e.narration.toLowerCase().includes(q) ||
          e.reference.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.status.toLowerCase().includes(q);

        const matchesLines = e.lines.some(
          (l) =>
            l.accountName.toLowerCase().includes(q) ||
            (l.accountCode && l.accountCode.toLowerCase().includes(q)) ||
            (l.narration && l.narration.toLowerCase().includes(q))
        );

        return matchesMain || matchesLines;
      });
    }

    // 4. Filter by Type
    if (query.type && query.type !== "all" && query.type !== "All Types") {
      const targetType = query.type.toLowerCase().trim();
      filtered = filtered.filter((e) => e.type.toLowerCase() === targetType);
    }

    // 5. Filter by Status
    if (query.status && query.status !== "all" && query.status !== "All Status") {
      const targetStatus = query.status.toLowerCase().trim();
      filtered = filtered.filter((e) => e.status.toLowerCase() === targetStatus);
    }

    // 6. Filter by Date Range
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter((e) => e.entryDate >= start);
      }
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter((e) => e.entryDate <= end);
      }
    }

    // 7. Sort
    const sort = query.sortBy || "Date (Newest)";
    if (sort.includes("Oldest") || sort === "date-asc") {
      filtered.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
    } else if (sort.includes("High to Low") || sort === "amount-desc") {
      filtered.sort((a, b) => b.totalDebit - a.totalDebit);
    } else if (sort.includes("Low to High") || sort === "amount-asc") {
      filtered.sort((a, b) => a.totalDebit - b.totalDebit);
    } else {
      // Default: Newest first
      filtered.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
    }

    // 8. Pagination
    const totalCount = filtered.length;
    const limit = query.limit || 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const currentPage = Math.min(Math.max(1, query.page || 1), totalPages);
    const startIndex = (currentPage - 1) * limit;
    const pagedRaw = filtered.slice(startIndex, startIndex + limit);

    // 9. Format items for UI consumption
    const pagedItems: FormattedJournalItem[] = pagedRaw.map((e) => {
      const { dateStr, timeStr } = this.formatDateStrings(e.entryDate);
      return {
        id: e.id,
        date: dateStr,
        time: timeStr,
        dateTime: e.entryDate.toISOString(),
        journalNo: e.journalNo,
        journalTypeLabel: this.capitalize(e.type),
        type: e.type,
        reference: e.reference || "-",
        narration: e.narration,
        debit: e.totalDebit,
        credit: e.totalCredit,
        status: e.status,
        lines: e.lines,
      };
    });

    return {
      totalJournals,
      totalDebit,
      totalCredit,
      outOfBalanceCount,
      difference,
      isBalanced,
      pagedItems,
      totalCount,
      totalPages,
      currentPage,
    };
  }

  /**
   * 2. Get Single Journal Entry Detail
   */
  async getJournalDetail(businessId: string, id: string): Promise<FormattedJournalItem> {
    const entry = await this.repo.findById(businessId, id);
    if (!entry) {
      throw new ErrorResponse(`Journal Entry with ID '${id}' not found`, 404);
    }

    const { dateStr, timeStr } = this.formatDateStrings(entry.entryDate);
    return {
      id: entry.id,
      date: dateStr,
      time: timeStr,
      dateTime: entry.entryDate.toISOString(),
      journalNo: entry.journalNo,
      journalTypeLabel: this.capitalize(entry.type),
      type: entry.type,
      reference: entry.reference || "-",
      narration: entry.narration,
      debit: entry.totalDebit,
      credit: entry.totalCredit,
      status: entry.status,
      lines: entry.lines,
    };
  }

  /**
   * 3. Create a new Double-Entry Journal Entry
   */
  async createJournalEntry(
    businessId: string,
    input: CreateJournalEntryInput
  ): Promise<FormattedJournalItem> {
    const rawLines: {
      accountId: string;
      accountName?: string;
      debitAmount: number;
      creditAmount: number;
      narration?: string;
    }[] = [];

    if (input.lines && input.lines.length > 0) {
      for (const l of input.lines) {
        rawLines.push({
          accountId: l.accountId,
          accountName: l.accountName,
          debitAmount: Number(l.debitAmount) || 0,
          creditAmount: Number(l.creditAmount) || 0,
          narration: l.narration,
        });
      }
    } else if (input.debitAccountId && input.creditAccountId) {
      const amount = Number(input.debitAmount ?? input.creditAmount ?? 0);
      rawLines.push({
        accountId: input.debitAccountId,
        debitAmount: amount,
        creditAmount: 0,
        narration: input.narration,
      });
      rawLines.push({
        accountId: input.creditAccountId,
        debitAmount: 0,
        creditAmount: amount,
        narration: input.narration,
      });
    }

    if (rawLines.length < 2) {
      throw new ErrorResponse("A valid journal entry requires at least two lines", 400);
    }

    const sumDebit = rawLines.reduce((s, l) => s + l.debitAmount, 0);
    const sumCredit = rawLines.reduce((s, l) => s + l.creditAmount, 0);

    const normStatus = (input.status || "posted").toLowerCase() as "posted" | "draft" | "voided";
    const normType = (input.type || "standard").toLowerCase() as "standard" | "adjustment" | "recurring" | "template";

    // Double-entry accounting rule: debits must equal credits for posted entries
    if (normStatus === "posted" && Math.abs(sumDebit - sumCredit) > 0.01) {
      throw new ErrorResponse(
        `Journal entry is out of balance! Total Debit (₹${sumDebit.toFixed(2)}) does not equal Total Credit (₹${sumCredit.toFixed(2)}). Difference: ₹${Math.abs(sumDebit - sumCredit).toFixed(2)}`,
        400
      );
    }

    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();

    const created = await this.repo.create(businessId, {
      entryDate,
      type: normType,
      status: normStatus,
      reference: input.reference || "-",
      narration: input.narration.trim(),
      lines: rawLines,
    });

    const { dateStr, timeStr } = this.formatDateStrings(created.entryDate);
    return {
      id: created.id,
      date: dateStr,
      time: timeStr,
      dateTime: created.entryDate.toISOString(),
      journalNo: created.journalNo,
      journalTypeLabel: this.capitalize(created.type),
      type: created.type,
      reference: created.reference,
      narration: created.narration,
      debit: created.totalDebit,
      credit: created.totalCredit,
      status: created.status,
      lines: created.lines,
    };
  }

  /**
   * 4. Update an existing journal entry
   */
  async updateJournalEntry(
    businessId: string,
    id: string,
    input: UpdateJournalEntryInput
  ): Promise<FormattedJournalItem> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) {
      throw new ErrorResponse(`Journal Entry with ID '${id}' not found`, 404);
    }

    let rawLines: any = undefined;
    if (input.lines && input.lines.length > 0) {
      rawLines = input.lines.map((l) => ({
        accountId: l.accountId,
        accountName: l.accountName,
        debitAmount: Number(l.debitAmount) || 0,
        creditAmount: Number(l.creditAmount) || 0,
        narration: l.narration,
      }));

      const sumDebit = rawLines.reduce((s: number, l: any) => s + l.debitAmount, 0);
      const sumCredit = rawLines.reduce((s: number, l: any) => s + l.creditAmount, 0);

      const targetStatus = (input.status || existing.status).toLowerCase();
      if (targetStatus === "posted" && Math.abs(sumDebit - sumCredit) > 0.01) {
        throw new ErrorResponse(
          `Journal entry is out of balance! Total Debit (₹${sumDebit.toFixed(2)}) must equal Total Credit (₹${sumCredit.toFixed(2)})`,
          400
        );
      }
    }

    const updated = await this.repo.update(businessId, id, {
      entryDate: input.entryDate ? new Date(input.entryDate) : undefined,
      type: input.type ? (input.type.toLowerCase() as any) : undefined,
      status: input.status ? (input.status.toLowerCase() as any) : undefined,
      reference: input.reference,
      narration: input.narration?.trim(),
      lines: rawLines,
    });

    if (!updated) {
      throw new ErrorResponse(`Failed to update Journal Entry '${id}'`, 500);
    }

    const { dateStr, timeStr } = this.formatDateStrings(updated.entryDate);
    return {
      id: updated.id,
      date: dateStr,
      time: timeStr,
      dateTime: updated.entryDate.toISOString(),
      journalNo: updated.journalNo,
      journalTypeLabel: this.capitalize(updated.type),
      type: updated.type,
      reference: updated.reference,
      narration: updated.narration,
      debit: updated.totalDebit,
      credit: updated.totalCredit,
      status: updated.status,
      lines: updated.lines,
    };
  }

  /**
   * 5. Void a journal entry
   */
  async voidJournalEntry(businessId: string, id: string): Promise<{ message: string; success: boolean }> {
    const success = await this.repo.voidEntry(businessId, id);
    if (!success) {
      throw new ErrorResponse(`Could not void journal entry '${id}'`, 400);
    }
    return { message: "Journal entry has been marked as VOIDED", success: true };
  }

  /**
   * 6. Delete a journal entry
   */
  async deleteJournalEntry(businessId: string, id: string): Promise<{ message: string; success: boolean }> {
    const success = await this.repo.delete(businessId, id);
    if (!success) {
      throw new ErrorResponse(`Could not delete journal entry '${id}'`, 400);
    }
    return { message: "Journal entry deleted successfully", success: true };
  }

  /**
   * 7. Get Chart of Accounts for dropdown selection
   */
  async getAccounts(businessId: string): Promise<{ id: string; name: string; code: string; type: string }[]> {
    return await this.repo.getAccounts(businessId);
  }

  /**
   * 8. Export Journal entries to CSV
   */
  async exportJournals(
    businessId: string,
    query: ExportJournalQueryParams
  ): Promise<{ csv: string; filename: string }> {
    const result = await this.getJournalEntries(businessId, {
      tab: query.tab as any,
      search: query.search,
      type: query.type || "all",
      status: query.status || "all",
      startDate: query.startDate,
      endDate: query.endDate,
      sortBy: query.sortBy || "Date (Newest)",
      page: 1,
      limit: 1000,
    });

    const headers = [
      "Date",
      "Time",
      "Journal No",
      "Type",
      "Reference",
      "Narration",
      "Debit (₹)",
      "Credit (₹)",
      "Status",
    ];

    const rows = result.pagedItems.map((e) => [
      `"${e.date}"`,
      `"${e.time}"`,
      `"${e.journalNo}"`,
      `"${e.journalTypeLabel}"`,
      `"${e.reference}"`,
      `"${e.narration.replace(/"/g, '""')}"`,
      e.debit.toFixed(2),
      e.credit.toFixed(2),
      `"${this.capitalize(e.status)}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const filename = `journal_entries_${new Date().toISOString().split("T")[0]}.csv`;

    return { csv: csvContent, filename };
  }
}

export const journalEntriesService = new JournalEntriesService();
