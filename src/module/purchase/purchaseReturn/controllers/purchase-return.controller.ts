import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  purchaseReturnService,
  PurchaseReturnService,
} from "../services/purchase-return.service";
import {
  createPurchaseReturnSchema,
  eligiblePurchaseQuerySchema,
  purchaseReturnQuerySchema,
  updatePurchaseReturnSchema,
  updatePurchaseReturnStatusSchema,
} from "../validators/purchase-return.validators";

export class PurchaseReturnController {
  private service: PurchaseReturnService;

  constructor(service: PurchaseReturnService = purchaseReturnService) {
    this.service = service;
  }

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
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * GET /api/v1/purchase-returns/next-number
   */
  getNextNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getNextDebitNoteNumber(businessId);
    return SuccessResponse(res, "Next debit note number generated", result, 200);
  });

  /**
   * GET /api/v1/purchase-returns/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(
      res,
      "Purchase return metrics retrieved successfully",
      metrics,
      200
    );
  });

  /**
   * GET /api/v1/purchase-returns/eligible-purchases
   * Confirmed purchases that still have returnable quantity
   */
  getEligiblePurchases = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const query = eligiblePurchaseQuerySchema.parse(req.query);
      const result = await this.service.getEligiblePurchases(businessId, query);
      return SuccessResponse(
        res,
        "Eligible purchases for return retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * GET /api/v1/purchase-returns/purchases/:purchaseId/items
   */
  getReturnableItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const purchaseId = req.params.purchaseId as string;
      if (!purchaseId) {
        throw new ErrorResponse("Purchase ID is required", 400);
      }
      const result = await this.service.getReturnableItems(businessId, purchaseId);
      return SuccessResponse(
        res,
        "Returnable purchase items retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * POST /api/v1/purchase-returns
   */
  createPurchaseReturn = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const input = createPurchaseReturnSchema.parse(req.body);
      const purchaseReturn = await this.service.createPurchaseReturn(
        businessId,
        input
      );
      return SuccessResponse(
        res,
        purchaseReturn.status === "draft"
          ? "Purchase return draft saved successfully"
          : "Purchase return / debit note issued successfully",
        purchaseReturn,
        201
      );
    }
  );

  /**
   * GET /api/v1/purchase-returns
   */
  getPurchaseReturns = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const query = purchaseReturnQuerySchema.parse(req.query);
      const result = await this.service.getPurchaseReturns(businessId, query);
      return SuccessResponse(
        res,
        "Purchase returns retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * GET /api/v1/purchase-returns/:id
   */
  getPurchaseReturnById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
      const purchaseReturn = await this.service.getPurchaseReturnById(
        businessId,
        id
      );
      return SuccessResponse(
        res,
        "Purchase return details retrieved successfully",
        purchaseReturn,
        200
      );
    }
  );

  /**
   * PUT/PATCH /api/v1/purchase-returns/:id
   */
  updatePurchaseReturn = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
      const input = updatePurchaseReturnSchema.parse(req.body);
      const purchaseReturn = await this.service.updatePurchaseReturn(
        businessId,
        id,
        input
      );
      return SuccessResponse(
        res,
        "Purchase return updated successfully",
        purchaseReturn,
        200
      );
    }
  );

  /**
   * POST /api/v1/purchase-returns/:id/confirm
   */
  confirmPurchaseReturn = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
      const purchaseReturn = await this.service.confirmPurchaseReturn(
        businessId,
        id
      );
      return SuccessResponse(
        res,
        "Purchase return confirmed, stock reduced and debit note applied",
        purchaseReturn,
        200
      );
    }
  );

  /**
   * PATCH /api/v1/purchase-returns/:id/status
   */
  updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
    const input = updatePurchaseReturnStatusSchema.parse(req.body);
    const purchaseReturn = await this.service.updateStatus(businessId, id, input);
    return SuccessResponse(
      res,
      "Purchase return status updated successfully",
      purchaseReturn,
      200
    );
  });

  /**
   * POST /api/v1/purchase-returns/:id/cancel
   */
  cancelPurchaseReturn = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
      const purchaseReturn = await this.service.cancelPurchaseReturn(
        businessId,
        id
      );
      return SuccessResponse(
        res,
        "Purchase return cancelled successfully",
        purchaseReturn,
        200
      );
    }
  );

  /**
   * DELETE /api/v1/purchase-returns/:id
   */
  deletePurchaseReturn = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase return ID is required", 400);
      const result = await this.service.deletePurchaseReturn(businessId, id);
      return SuccessResponse(res, result.message, result, 200);
    }
  );
}

export const purchaseReturnController = new PurchaseReturnController();
