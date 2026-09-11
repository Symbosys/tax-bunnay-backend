import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  stockValuationService,
  StockValuationService,
} from "../services/stock-valuation.service";
import {
  stockAdjustmentSchema,
  stockMovementQuerySchema,
  stockValuationQuerySchema,
} from "../validators/stock-valuation.validators";

export class StockValuationController {
  private service: StockValuationService;

  constructor(service: StockValuationService = stockValuationService) {
    this.service = service;
  }

  private extractBusinessId(req: AuthenticatedRequest): string {
    if ((req as any).businessId && typeof (req as any).businessId === "string") {
      return (req as any).businessId.trim();
    }

    const headerId = (req.headers["x-business-id"] ||
      req.headers["X-Business-ID"]) as string;
    if (headerId?.trim()) return headerId.trim();

    if (typeof req.query.businessId === "string" && req.query.businessId.trim()) {
      return req.query.businessId.trim();
    }

    if (req.body?.businessId && typeof req.body.businessId === "string") {
      return req.body.businessId.trim();
    }

    if (req.user?.ownedBusinesses?.length) {
      return req.user.ownedBusinesses[0].id;
    }

    if (req.user?.businessMemberships?.length) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  getSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const warehouseId =
      typeof req.query.warehouseId === "string"
        ? req.query.warehouseId.trim()
        : undefined;

    const summary = await this.service.getSummary(businessId, warehouseId);
    return SuccessResponse(
      res,
      "Stock valuation summary retrieved successfully",
      summary,
      200
    );
  });

  getItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const params = stockValuationQuerySchema.parse(req.query);
    const result = await this.service.getValuationItems(businessId, params);
    return SuccessResponse(
      res,
      "Stock valuation items retrieved successfully",
      result,
      200
    );
  });

  getMovements = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const params = stockMovementQuerySchema.parse(req.query);
    const result = await this.service.getStockMovements(businessId, params);
    return SuccessResponse(
      res,
      "Stock movements retrieved successfully",
      result,
      200
    );
  });

  createAdjustment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const input = stockAdjustmentSchema.parse(req.body);
      const movement = await this.service.createAdjustment(businessId, input);
      return SuccessResponse(
        res,
        "Stock adjustment recorded successfully",
        movement,
        201
      );
    }
  );
}

export const stockValuationController = new StockValuationController();
