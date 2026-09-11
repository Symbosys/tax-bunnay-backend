import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  goodsWarehouseService,
  GoodsWarehouseService,
} from "../services/goods-warehouse.service";
import {
  createStockTransferSchema,
  createWarehouseSchema,
  transferQuerySchema,
  updateWarehouseSchema,
  warehouseQuerySchema,
} from "../validators/goods-warehouse.validators";

export class GoodsWarehouseController {
  private service: GoodsWarehouseService;

  constructor(service: GoodsWarehouseService = goodsWarehouseService) {
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

  listWarehouses = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const params = warehouseQuerySchema.parse(req.query);
      const warehouses = await this.service.listWarehouses(businessId, params);
      return SuccessResponse(
        res,
        "Warehouse locations retrieved successfully",
        { items: warehouses },
        200
      );
    }
  );

  createWarehouse = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const input = createWarehouseSchema.parse(req.body);
      const warehouse = await this.service.createWarehouse(businessId, input);
      return SuccessResponse(
        res,
        "Warehouse location created successfully",
        warehouse,
        201
      );
    }
  );

  updateWarehouse = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const warehouseId = String(req.params.id || "").trim();
      if (!warehouseId) {
        throw new ErrorResponse("Warehouse ID is required", 400);
      }
      const input = updateWarehouseSchema.parse(req.body);
      const warehouse = await this.service.updateWarehouse(
        businessId,
        warehouseId,
        input
      );
      return SuccessResponse(
        res,
        "Warehouse location updated successfully",
        warehouse,
        200
      );
    }
  );

  listProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const products = await this.service.listProducts(businessId);
      return SuccessResponse(
        res,
        "Warehouse products retrieved successfully",
        { items: products },
        200
      );
    }
  );

  listTransfers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const params = transferQuerySchema.parse(req.query);
      const result = await this.service.listTransfers(businessId, params);
      return SuccessResponse(
        res,
        "Stock transfer history retrieved successfully",
        result,
        200
      );
    }
  );

  createTransfer = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const input = createStockTransferSchema.parse(req.body);
      const transfer = await this.service.createTransfer(businessId, input);
      return SuccessResponse(
        res,
        "Stock transfer recorded successfully",
        transfer,
        201
      );
    }
  );
}

export const goodsWarehouseController = new GoodsWarehouseController();
