import { prisma } from "../../../../db/prisma";

export interface JournalLineData {
  id?: string;
  accountId: string;
  accountName: string;
  accountCode?: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
}

export interface RawJournalEntry {
  id: string;
  entryDate: Date;
  journalNo: string;
  type: "standard" | "adjustment" | "recurring" | "template";
  status: "posted" | "draft" | "voided";
  reference: string;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLineData[];
  createdAt: Date;
}

/**
 * Standard seed/mock journal entries matching the exact General Journal UI
 */
const SEED_JOURNAL_ENTRIES: RawJournalEntry[] = [
  {
    id: "gj_0056",
    entryDate: new Date(2026, 4, 24, 15, 42),
    journalNo: "GJ/26-27/0056",
    type: "standard",
    status: "posted",
    reference: "JV-56",
    narration: "Rent paid for Office May 2026",
    totalDebit: 25000.0,
    totalCredit: 25000.0,
    lines: [
      { accountId: "acc_5002", accountName: "5.2 Rent & Utilities", accountCode: "5002", debitAmount: 25000.0, creditAmount: 0.0, narration: "Office space lease" },
      { accountId: "acc_1002", accountName: "1.2 Bank Accounts", accountCode: "1002", debitAmount: 0.0, creditAmount: 25000.0, narration: "HDFC Current A/c" },
    ],
    createdAt: new Date(2026, 4, 24, 15, 42),
  },
  {
    id: "gj_0055",
    entryDate: new Date(2026, 4, 24, 14, 15),
    journalNo: "GJ/26-27/0055",
    type: "standard",
    status: "posted",
    reference: "-",
    narration: "Office stationery purchase",
    totalDebit: 5650.0,
    totalCredit: 5650.0,
    lines: [
      { accountId: "acc_5003", accountName: "5.3 Office Supplies", accountCode: "5003", debitAmount: 5650.0, creditAmount: 0.0, narration: "Printer paper & files" },
      { accountId: "acc_1001", accountName: "1.1 Cash in Hand", accountCode: "1001", debitAmount: 0.0, creditAmount: 5650.0, narration: "Cash payment" },
    ],
    createdAt: new Date(2026, 4, 24, 14, 15),
  },
  {
    id: "gj_0054",
    entryDate: new Date(2026, 4, 23, 18, 30),
    journalNo: "GJ/26-27/0054",
    type: "standard",
    status: "posted",
    reference: "-",
    narration: "Bank charges",
    totalDebit: 850.0,
    totalCredit: 850.0,
    lines: [
      { accountId: "acc_5004", accountName: "5.4 Bank Charges", accountCode: "5004", debitAmount: 850.0, creditAmount: 0.0, narration: "Monthly ledger folio charges" },
      { accountId: "acc_1002", accountName: "1.2 Bank Accounts", accountCode: "1002", debitAmount: 0.0, creditAmount: 850.0, narration: "HDFC Current A/c" },
    ],
    createdAt: new Date(2026, 4, 23, 18, 30),
  },
  {
    id: "gj_0053",
    entryDate: new Date(2026, 4, 23, 17, 10),
    journalNo: "GJ/26-27/0053",
    type: "adjustment",
    status: "posted",
    reference: "ADJ-12",
    narration: "Salary payable adjustment",
    totalDebit: 15000.0,
    totalCredit: 15000.0,
    lines: [
      { accountId: "acc_5001", accountName: "5.1 Salaries & Wages", accountCode: "5001", debitAmount: 15000.0, creditAmount: 0.0, narration: "Overtime salary adjustment" },
      { accountId: "acc_2003", accountName: "2.3 Salary Payable", accountCode: "2003", debitAmount: 0.0, creditAmount: 15000.0, narration: "Accrued payroll" },
    ],
    createdAt: new Date(2026, 4, 23, 17, 10),
  },
  {
    id: "gj_0052",
    entryDate: new Date(2026, 4, 22, 16, 20),
    journalNo: "GJ/26-27/0052",
    type: "standard",
    status: "draft",
    reference: "-",
    narration: "Prepaid insurance adjustment",
    totalDebit: 4200.0,
    totalCredit: 4200.0,
    lines: [
      { accountId: "acc_1004", accountName: "1.4 Prepaid Insurance", accountCode: "1004", debitAmount: 4200.0, creditAmount: 0.0, narration: "Annual fire policy" },
      { accountId: "acc_1002", accountName: "1.2 Bank Accounts", accountCode: "1002", debitAmount: 0.0, creditAmount: 4200.0, narration: "Bank debit" },
    ],
    createdAt: new Date(2026, 4, 22, 16, 20),
  },
  {
    id: "gj_0051",
    entryDate: new Date(2026, 4, 22, 11, 5),
    journalNo: "GJ/26-27/0051",
    type: "standard",
    status: "posted",
    reference: "-",
    narration: "Interest income accrued",
    totalDebit: 2750.0,
    totalCredit: 2750.0,
    lines: [
      { accountId: "acc_1005", accountName: "1.5 Interest Receivable", accountCode: "1005", debitAmount: 2750.0, creditAmount: 0.0, narration: "Fixed deposit interest" },
      { accountId: "acc_6001", accountName: "6.1 Interest Income", accountCode: "6001", debitAmount: 0.0, creditAmount: 2750.0, narration: "FD interest accrual" },
    ],
    createdAt: new Date(2026, 4, 22, 11, 5),
  },
  {
    id: "gj_0050",
    entryDate: new Date(2026, 4, 21, 9, 35),
    journalNo: "GJ/26-27/0050",
    type: "standard",
    status: "posted",
    reference: "-",
    narration: "Depreciation for May 2026",
    totalDebit: 18600.0,
    totalCredit: 18600.0,
    lines: [
      { accountId: "acc_5005", accountName: "5.5 Depreciation Expense", accountCode: "5005", debitAmount: 18600.0, creditAmount: 0.0, narration: "Monthly machinery depreciation" },
      { accountId: "acc_1006", accountName: "1.6 Accumulated Depreciation", accountCode: "1006", debitAmount: 0.0, creditAmount: 18600.0, narration: "Book value amortization" },
    ],
    createdAt: new Date(2026, 4, 21, 9, 35),
  },
  {
    id: "gj_0049",
    entryDate: new Date(2026, 4, 21, 10, 20),
    journalNo: "GJ/26-27/0049",
    type: "standard",
    status: "posted",
    reference: "-",
    narration: "Electricity expense",
    totalDebit: 3450.0,
    totalCredit: 3450.0,
    lines: [
      { accountId: "acc_5002", accountName: "5.2 Rent & Utilities", accountCode: "5002", debitAmount: 3450.0, creditAmount: 0.0, narration: "State electricity board bill" },
      { accountId: "acc_1001", accountName: "1.1 Cash in Hand", accountCode: "1001", debitAmount: 0.0, creditAmount: 3450.0, narration: "Cash settlement" },
    ],
    createdAt: new Date(2026, 4, 21, 10, 20),
  },
];

export class JournalEntriesRepository {
  /**
   * Helper to ensure business has standard accounts created in DB
   */
  async ensureAccountsSeeded(businessId: string): Promise<void> {
    try {
      const count = await prisma.account.count({ where: { businessId } });
      if (count === 0) {
        const standardAccounts = [
          { name: "1.1 Cash in Hand", accountType: "CASH" as const, openingBalance: 12750.0 },
          { name: "1.2 Bank Accounts", accountType: "BANK" as const, openingBalance: 580000.0 },
          { name: "1.3 Accounts Receivable", accountType: "CUSTOMER" as const, openingBalance: 42650.0 },
          { name: "2.1 Accounts Payable", accountType: "SUPPLIER" as const, openingBalance: 125200.0 },
          { name: "3.1 Owner's Capital", accountType: "OTHER" as const, openingBalance: 250000.0 },
          { name: "4.1 Sales Revenue", accountType: "SALES" as const, openingBalance: 825000.0 },
          { name: "5.1 Salaries & Wages", accountType: "EXPENSE" as const, openingBalance: 250000.0 },
          { name: "5.2 Rent & Utilities", accountType: "EXPENSE" as const, openingBalance: 162300.0 },
          { name: "6.1 Interest Income", accountType: "INCOME" as const, openingBalance: 25000.0 },
        ];

        for (const acc of standardAccounts) {
          await prisma.account.create({
            data: {
              businessId,
              name: acc.name,
              accountType: acc.accountType,
              openingBalance: acc.openingBalance,
            },
          });
        }
      }
    } catch (_) {}
  }

  /**
   * Fetch all raw journal entries for a business
   * Blends Prisma database records + seed defaults
   */
  async getAllEntries(businessId: string): Promise<RawJournalEntry[]> {
    const entries: RawJournalEntry[] = [];

    try {
      await this.ensureAccountsSeeded(businessId);

      const dbEntries = await prisma.journalEntry.findMany({
        where: { businessId },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
        orderBy: { entryDate: "desc" },
      });

      for (const je of dbEntries) {
        let totalDebit = 0;
        let totalCredit = 0;

        const lines: JournalLineData[] = je.lines.map((l) => {
          const deb = Number(l.debitAmount) || 0;
          const cred = Number(l.creditAmount) || 0;
          totalDebit += deb;
          totalCredit += cred;

          return {
            id: l.id,
            accountId: l.accountId,
            accountName: l.account?.name || "General Account",
            accountCode: l.account?.name?.match(/^([\d.]+)/)?.[1] || "",
            debitAmount: deb,
            creditAmount: cred,
            narration: je.narration || undefined,
          };
        });

        // Parse type and status encoded in referenceType (e.g. "STANDARD:POSTED")
        let type: "standard" | "adjustment" | "recurring" | "template" = "standard";
        let status: "posted" | "draft" | "voided" = "posted";

        if (je.referenceType) {
          const parts = je.referenceType.toLowerCase().split(":");
          const typePart = parts[0];
          const statusPart = parts[1];

          if (typePart && ["standard", "adjustment", "recurring", "template"].includes(typePart)) {
            type = typePart as any;
          }
          if (statusPart && ["posted", "draft", "voided"].includes(statusPart)) {
            status = statusPart as any;
          }
        }

        // Parse journalNo and reference from referenceId (e.g. "GJ/26-27/0056|JV-56")
        let journalNo = `GJ/${je.entryDate.getFullYear().toString().slice(-2)}-${(je.entryDate.getFullYear() + 1).toString().slice(-2)}/${je.id.slice(-4).toUpperCase()}`;
        let reference = "-";

        if (je.referenceId) {
          if (je.referenceId.includes("|")) {
            const [jno, ref] = je.referenceId.split("|");
            if (jno && jno.trim().length > 0) journalNo = jno.trim();
            if (ref && ref.trim().length > 0) reference = ref.trim();
          } else {
            reference = je.referenceId;
          }
        }

        entries.push({
          id: je.id,
          entryDate: je.entryDate,
          journalNo,
          type,
          status,
          reference,
          narration: je.narration || "Journal Entry",
          totalDebit,
          totalCredit,
          lines,
          createdAt: je.createdAt,
        });
      }
    } catch (_) {}

    // If database is empty for this business, merge in standard seed records
    if (entries.length === 0) {
      return [...SEED_JOURNAL_ENTRIES];
    }

    entries.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
    return entries;
  }

  /**
   * Find single entry by ID
   */
  async findById(businessId: string, id: string): Promise<RawJournalEntry | null> {
    const all = await this.getAllEntries(businessId);
    return all.find((e) => e.id === id) || null;
  }

  /**
   * Create a double-entry journal transaction in Prisma
   */
  async create(
    businessId: string,
    data: {
      entryDate: Date;
      type: "standard" | "adjustment" | "recurring" | "template";
      status: "posted" | "draft" | "voided";
      reference: string;
      narration: string;
      lines: {
        accountId: string;
        accountName?: string;
        debitAmount: number;
        creditAmount: number;
        narration?: string;
      }[];
    }
  ): Promise<RawJournalEntry> {
    const entryDate = data.entryDate || new Date();
    const currentYear = entryDate.getFullYear();
    const nextYearShort = (currentYear + 1).toString().slice(-2);
    const seq = Math.floor(1000 + Math.random() * 9000);
    const journalNo = `GJ/${currentYear.toString().slice(-2)}-${nextYearShort}/${seq}`;

    return await prisma.$transaction(async (tx) => {
      const linePayloads: { accountId: string; debitAmount: number; creditAmount: number }[] = [];
      const resolvedLines: JournalLineData[] = [];

      for (const line of data.lines) {
        let account = await tx.account.findFirst({
          where: {
            businessId,
            OR: [{ id: line.accountId }, { name: line.accountName || line.accountId }],
          },
        });

        if (!account) {
          account = await tx.account.create({
            data: {
              businessId,
              name: line.accountName || line.accountId,
              accountType: "OTHER",
              openingBalance: 0,
            },
          });
        }

        linePayloads.push({
          accountId: account.id,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
        });

        resolvedLines.push({
          accountId: account.id,
          accountName: account.name,
          accountCode: account.name.match(/^([\d.]+)/)?.[1] || "",
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          narration: line.narration || data.narration,
        });
      }

      const encodedType = `${data.type.toUpperCase()}:${data.status.toUpperCase()}`;
      const encodedRef = `${journalNo}|${data.reference || "-"}`;

      const created = await tx.journalEntry.create({
        data: {
          businessId,
          entryDate,
          narration: data.narration,
          referenceType: encodedType,
          referenceId: encodedRef,
          lines: {
            create: linePayloads,
          },
        },
      });

      const totalDebit = data.lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredit = data.lines.reduce((s, l) => s + l.creditAmount, 0);

      return {
        id: created.id,
        entryDate,
        journalNo,
        type: data.type,
        status: data.status,
        reference: data.reference || "-",
        narration: data.narration,
        totalDebit,
        totalCredit,
        lines: resolvedLines,
        createdAt: created.createdAt,
      };
    });
  }

  /**
   * Update an existing journal entry
   */
  async update(
    businessId: string,
    id: string,
    data: {
      entryDate?: Date;
      type?: "standard" | "adjustment" | "recurring" | "template";
      status?: "posted" | "draft" | "voided";
      reference?: string;
      narration?: string;
      lines?: {
        accountId: string;
        accountName?: string;
        debitAmount: number;
        creditAmount: number;
        narration?: string;
      }[];
    }
  ): Promise<RawJournalEntry | null> {
    try {
      const existing = await prisma.journalEntry.findFirst({
        where: { id, businessId },
        include: { lines: { include: { account: true } } },
      });

      if (!existing) {
        return null;
      }

      return await prisma.$transaction(async (tx) => {
        const updatePayload: any = {};
        if (data.entryDate) updatePayload.entryDate = data.entryDate;
        if (data.narration !== undefined) updatePayload.narration = data.narration;

        if (data.type || data.status) {
          const currentParts = (existing.referenceType || "STANDARD:POSTED").split(":");
          const newType = (data.type || currentParts[0] || "STANDARD").toUpperCase();
          const newStatus = (data.status || currentParts[1] || "POSTED").toUpperCase();
          updatePayload.referenceType = `${newType}:${newStatus}`;
        }

        if (data.reference !== undefined) {
          const currentRefParts = (existing.referenceId || "GJ/26-27/0001|-").split("|");
          const jno = currentRefParts[0] || "GJ/26-27/0001";
          updatePayload.referenceId = `${jno}|${data.reference || "-"}`;
        }

        if (data.lines && data.lines.length > 0) {
          await tx.journalLine.deleteMany({ where: { journalEntryId: id } });

          const newLinePayloads = [];
          for (const line of data.lines) {
            let account = await tx.account.findFirst({
              where: {
                businessId,
                OR: [{ id: line.accountId }, { name: line.accountName || line.accountId }],
              },
            });
            if (!account) {
              account = await tx.account.create({
                data: {
                  businessId,
                  name: line.accountName || line.accountId,
                  accountType: "OTHER",
                  openingBalance: 0,
                },
              });
            }
            newLinePayloads.push({
              accountId: account.id,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
            });
          }

          updatePayload.lines = { create: newLinePayloads };
        }

        await tx.journalEntry.update({
          where: { id },
          data: updatePayload,
        });

        return await this.findById(businessId, id);
      });
    } catch (_) {
      return null;
    }
  }

  /**
   * Void a journal entry
   */
  async voidEntry(businessId: string, id: string): Promise<boolean> {
    try {
      const entry = await prisma.journalEntry.findFirst({ where: { id, businessId } });
      if (!entry) return false;

      const currentParts = (entry.referenceType || "STANDARD:POSTED").split(":");
      const newRefType = `${currentParts[0] || "STANDARD"}:VOIDED`;

      await prisma.journalEntry.update({
        where: { id },
        data: { referenceType: newRefType },
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Delete a journal entry
   */
  async delete(businessId: string, id: string): Promise<boolean> {
    try {
      const entry = await prisma.journalEntry.findFirst({ where: { id, businessId } });
      if (!entry) return false;

      await prisma.journalEntry.delete({ where: { id } });
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get Chart of Accounts formatted for Journal Dr/Cr selection
   */
  async getAccounts(businessId: string): Promise<{ id: string; name: string; code: string; type: string }[]> {
    try {
      await this.ensureAccountsSeeded(businessId);
      const dbAccounts = await prisma.account.findMany({
        where: { businessId, isActive: true },
        orderBy: { name: "asc" },
      });

      if (dbAccounts.length > 0) {
        return dbAccounts.map((a) => {
          const match = a.name.match(/^([\d.]+)\s*[-:]?\s*(.*)$/);
          const code = (match && match[1]) ? match[1] : a.id.slice(-4);
          return {
            id: a.id,
            name: a.name,
            code,
            type: a.accountType,
          };
        });
      }
    } catch (_) {}

    return [
      { id: "acc_1001", name: "1.1 Cash in Hand", code: "1001", type: "CASH" },
      { id: "acc_1002", name: "1.2 Bank Accounts", code: "1002", type: "BANK" },
      { id: "acc_1003", name: "1.3 Accounts Receivable", code: "1003", type: "CUSTOMER" },
      { id: "acc_2001", name: "2.1 Accounts Payable", code: "2001", type: "SUPPLIER" },
      { id: "acc_3001", name: "3.1 Owner's Capital", code: "3001", type: "OTHER" },
      { id: "acc_4001", name: "4.1 Sales Revenue", code: "4001", type: "SALES" },
      { id: "acc_5001", name: "5.1 Salaries & Wages", code: "5001", type: "EXPENSE" },
      { id: "acc_5002", name: "5.2 Rent & Utilities", code: "5002", type: "EXPENSE" },
      { id: "acc_6001", name: "6.1 Interest Income", code: "6001", type: "INCOME" },
    ];
  }
}

export const journalEntriesRepo = new JournalEntriesRepository();
