import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { outstandingService, OutstandingService } from "../services/outstanding.service";
import { outstandingQuerySchema } from "../validators/outstanding.validators";

export class OutstandingController {
  private service: OutstandingService;

  constructor(service: OutstandingService = outstandingService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    if ((req as any).businessId && typeof (req as any).businessId === "string") {
      return (req as any).businessId.trim();
    }

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

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * Get high-level KPI and Ageing summary for both Receivables and Payables
   * GET /api/v1/outstanding/summary
   */
  getOutstandingSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const summary = await this.service.getSummary(businessId);
    return SuccessResponse(res, "Outstanding summary retrieved successfully", summary, 200);
  });

  /**
   * Get detailed receivables list matching OutstandingPage
   * GET /api/v1/outstanding/receivables
   */
  getReceivables = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const params = outstandingQuerySchema.parse(req.query);

    const result = await this.service.getReceivables(businessId, params);
    return SuccessResponse(res, "Outstanding receivables retrieved successfully", result, 200);
  });

  /**
   * Get detailed payables list matching OutstandingPage
   * GET /api/v1/outstanding/payables
   */
  getPayables = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const params = outstandingQuerySchema.parse(req.query);

    const result = await this.service.getPayables(businessId, params);
    return SuccessResponse(res, "Outstanding payables retrieved successfully", result, 200);
  });

  /**
   * Get detailed outstanding status for a single customer or supplier
   * GET /api/v1/outstanding/party/:type/:id
   */
  getPartyOutstanding = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const type = req.params.type as string;
    const partyId = req.params.id as string;

    if (type !== "customer" && type !== "supplier") {
      throw new ErrorResponse("Invalid party type. Must be 'customer' or 'supplier'", 400);
    }

    if (!partyId) {
      throw new ErrorResponse("Party ID is required", 400);
    }

    const result = await this.service.getPartyOutstanding(businessId, type, partyId);
    return SuccessResponse(res, "Party outstanding analysis retrieved successfully", result, 200);
  });
}

export const outstandingController = new OutstandingController();
