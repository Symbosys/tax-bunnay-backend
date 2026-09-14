import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  journalEntriesService,
  JournalEntriesService,
} from "../services/journal-entries.service";
import {
  createJournalEntrySchema,
  exportJournalQuerySchema,
  journalEntriesQuerySchema,
  updateJournalEntrySchema,
} from "../validators/journal-entries.validators";

export class JournalEntriesController {
  private service: JournalEntriesService;

  constructor(service: JournalEntriesService = journalEntriesService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, query, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    const headerId = (req.headers["x-business-id"] || req.headers["X-Business-ID"]) as string;
    if (headerId && headerId.trim().length > 0) {
      return headerId.trim();
    }

    if (req.query.businessId && typeof req.query.businessId === "string") {
      return req.query.businessId.trim();
    }

    if (req.body?.businessId && typeof req.body.businessId === "string") {
      return req.body.businessId.trim();
    }

    if (req.user?.ownedBusinesses && req.user.ownedBusinesses.length > 0) {
      return req.user.ownedBusinesses[0].id;
    }

    if (req.user?.businessMemberships && req.user.businessMemberships.length > 0) {
      return req.user.businessMemberships[0].businessId;
    }

    return "biz_default_retail";
  }

  /**
   * 1. Get Journal Entries with 4 KPI cards, smart tabs, filters, and pagination
   * GET /api/v1/accounting/journal-entries
   */
  getJournalEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = journalEntriesQuerySchema.parse(req.query);
    const result = await this.service.getJournalEntries(businessId, query);

    return SuccessResponse(res, "Journal entries retrieved successfully", result, 200);
  });

  /**
   * 2. Get Single Journal Entry Detail with all double-entry legs
   * GET /api/v1/accounting/journal-entries/:id
   */
  getJournalDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Journal Entry ID parameter is required", 400);
    }

    const result = await this.service.getJournalDetail(businessId, id.trim());
    return SuccessResponse(res, "Journal entry detail retrieved successfully", result, 200);
  });

  /**
   * 3. Create a new balanced Double-Entry Journal Entry
   * POST /api/v1/accounting/journal-entries
   */
  createJournalEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createJournalEntrySchema.parse(req.body);
    const result = await this.service.createJournalEntry(businessId, input);

    return SuccessResponse(res, "Journal entry posted successfully", result, 201);
  });

  /**
   * 4. Update an existing Journal Entry
   * PUT /api/v1/accounting/journal-entries/:id
   */
  updateJournalEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Journal Entry ID parameter is required", 400);
    }

    const input = updateJournalEntrySchema.parse(req.body);
    const result = await this.service.updateJournalEntry(businessId, id.trim(), input);

    return SuccessResponse(res, "Journal entry updated successfully", result, 200);
  });

  /**
   * 5. Void a Journal Entry
   * POST /api/v1/accounting/journal-entries/:id/void
   */
  voidJournalEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Journal Entry ID parameter is required", 400);
    }

    const result = await this.service.voidJournalEntry(businessId, id.trim());
    return SuccessResponse(res, result.message, result, 200);
  });

  /**
   * 6. Delete a Journal Entry
   * DELETE /api/v1/accounting/journal-entries/:id
   */
  deleteJournalEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Journal Entry ID parameter is required", 400);
    }

    const result = await this.service.deleteJournalEntry(businessId, id.trim());
    return SuccessResponse(res, result.message, result, 200);
  });

  /**
   * 7. Get Chart of Accounts for Dr/Cr dropdown selection
   * GET /api/v1/accounting/journal-entries/accounts
   */
  getAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getAccounts(businessId);

    return SuccessResponse(res, "Accounts list retrieved successfully", result, 200);
  });

  /**
   * 8. Export Journal Day Book
   * GET /api/v1/accounting/journal-entries/export
   */
  exportJournals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = exportJournalQuerySchema.parse(req.query);
    const { csv, filename } = await this.service.exportJournals(businessId, query);

    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    return SuccessResponse(
      res,
      "Journal book exported successfully",
      {
        csv,
        filename,
      },
      200
    );
  });
}

export const journalEntriesController = new JournalEntriesController();
