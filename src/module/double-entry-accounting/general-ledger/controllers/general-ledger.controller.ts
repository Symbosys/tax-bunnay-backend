import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  generalLedgerService,
  GeneralLedgerService,
} from "../services/general-ledger.service";
import {
  createJournalVoucherSchema,
  exportLedgerQuerySchema,
  generalLedgerQuerySchema,
} from "../validators/general-ledger.validators";

export class GeneralLedgerController {
  private service: GeneralLedgerService;

  constructor(service: GeneralLedgerService = generalLedgerService) {
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

    // Default demo/fallback tenant if none specified
    return "biz_default_retail";
  }

  /**
   * 1. Get General Ledger with KPI Cards, Filters, and Table Data
   * GET /api/v1/accounting/general-ledger
   */
  getGeneralLedger = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = generalLedgerQuerySchema.parse(req.query);
    const result = await this.service.getGeneralLedger(businessId, query);

    return SuccessResponse(res, "General ledger retrieved successfully", result, 200);
  });

  /**
   * 2. Get Single Voucher Detail (with Double-Entry Legs)
   * GET /api/v1/accounting/general-ledger/:id
   */
  getVoucherDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    if (!id || id.trim().length === 0) {
      throw new ErrorResponse("Voucher ID parameter is required", 400);
    }

    const result = await this.service.getVoucherDetail(businessId, id.trim());
    return SuccessResponse(res, "Voucher detail retrieved successfully", result, 200);
  });

  /**
   * 3. Create Manual Double-Entry Journal Voucher
   * POST /api/v1/accounting/general-ledger/voucher
   */
  createVoucher = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createJournalVoucherSchema.parse(req.body);
    const result = await this.service.createVoucher(businessId, input);

    return SuccessResponse(res, "Journal voucher created successfully", result, 201);
  });

  /**
   * 4. Get Chart of Accounts for Dropdowns
   * GET /api/v1/accounting/general-ledger/accounts
   */
  getAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getAccounts(businessId);

    return SuccessResponse(res, "Accounts retrieved successfully", result, 200);
  });

  /**
   * 5. Export General Ledger Report
   * GET /api/v1/accounting/general-ledger/export
   */
  exportLedger = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = exportLedgerQuerySchema.parse(req.query);
    const { csv, filename } = await this.service.exportLedger(businessId, query);

    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    return SuccessResponse(
      res,
      "General ledger exported successfully",
      {
        csv,
        filename,
      },
      200
    );
  });
}

export const generalLedgerController = new GeneralLedgerController();
