import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  salesReturnService,
  SalesReturnService,
} from "../services/sales-return.service";
import {
  createSalesReturnSchema,
  salesReturnQuerySchema,
  updateSalesReturnSchema,
  updateSalesReturnStatusSchema,
} from "../validators/sales-return.validators";

export class SalesReturnController {
  private service: SalesReturnService;

  constructor(service: SalesReturnService = salesReturnService) {
    this.service = service;
  }

  /**
   * Helper to extract active Business ID from headers, query, body, or session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    const headerId = (req.headers["x-business-id"] ||
      req.headers["X-Business-ID"]) as string;
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

    if (
      req.user?.businessMemberships &&
      req.user.businessMemberships.length > 0
    ) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or ensure you have selected an active business.",
      400
    );
  }

  /**
   * GET /api/v1/sales/returns/next-number
   */
  getNextNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getNextNumber(businessId);
    return SuccessResponse(res, "Next return / credit note number generated", result, 200);
  });

  /**
   * GET /api/v1/sales/returns/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(res, "Sales returns summary metrics retrieved successfully", metrics, 200);
  });

  /**
   * POST /api/v1/sales/returns
   */
  createSalesReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validated = createSalesReturnSchema.parse(req.body);
    const userId = req.user?.id;
    const cashierName = req.user?.name || req.user?.email || "Counter 1";

    const result = await this.service.createSalesReturn(
      businessId,
      validated,
      userId,
      cashierName
    );

    return SuccessResponse(
      res,
      `Sales return ${result.salesReturn.returnNumber} recorded successfully`,
      result,
      201
    );
  });

  /**
   * GET /api/v1/sales/returns
   */
  getSalesReturns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = salesReturnQuerySchema.parse(req.query);
    const result = await this.service.getSalesReturns(businessId, query);
    return SuccessResponse(res, "Sales returns retrieved successfully", result, 200);
  });

  /**
   * GET /api/v1/sales/returns/:id
   */
  getSalesReturnById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const cashierName = req.user?.name || req.user?.email;

    const result = await this.service.getSalesReturnById(businessId, id, cashierName);
    return SuccessResponse(res, "Sales return retrieved successfully", result, 200);
  });

  /**
   * GET /api/v1/sales/returns/:id/receipt
   */
  getThermalReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const cashierName = req.user?.name || req.user?.email;

    const result = await this.service.getSalesReturnById(businessId, id, cashierName);
    return SuccessResponse(
      res,
      "Credit note thermal receipt payload generated successfully",
      result.receipt,
      200
    );
  });

  /**
   * PUT/PATCH /api/v1/sales/returns/:id
   */
  updateSalesReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const validated = updateSalesReturnSchema.parse(req.body);
    const userId = req.user?.id;

    const updated = await this.service.updateSalesReturn(businessId, id, validated, userId);
    return SuccessResponse(
      res,
      `Sales return ${updated.returnNumber} updated successfully`,
      updated,
      200
    );
  });

  /**
   * PATCH /api/v1/sales/returns/:id/status
   */
  updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const { status } = updateSalesReturnStatusSchema.parse(req.body);
    const userId = req.user?.id;

    const result = await this.service.updateStatus(businessId, id, status, userId);
    return SuccessResponse(
      res,
      `Sales return status changed to ${status}`,
      result,
      200
    );
  });

  /**
   * POST /api/v1/sales/returns/:id/confirm
   */
  confirmSalesReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const userId = req.user?.id;

    const confirmed = await this.service.confirmSalesReturn(businessId, id, userId);
    return SuccessResponse(
      res,
      `Sales return ${confirmed.returnNumber} confirmed. Inventory restocked & credit note generated.`,
      confirmed,
      200
    );
  });

  /**
   * POST /api/v1/sales/returns/:id/cancel
   */
  cancelSalesReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const userId = req.user?.id;

    const cancelled = await this.service.cancelSalesReturn(businessId, id, userId);
    return SuccessResponse(
      res,
      `Sales return ${cancelled.returnNumber} cancelled. Restocked stock reversed.`,
      cancelled,
      200
    );
  });

  /**
   * DELETE /api/v1/sales/returns/:id
   */
  deleteSalesReturn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const result = await this.service.deleteSalesReturn(businessId, id);
    return SuccessResponse(res, result.message, result, 200);
  });
}

export const salesReturnController = new SalesReturnController();
