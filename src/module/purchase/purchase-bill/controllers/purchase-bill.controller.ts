import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  purchaseBillService,
  PurchaseBillService,
} from "../services/purchase-bill.service";
import {
  createPurchaseBillSchema,
  createPurchaseProductSchema,
  purchaseBillQuerySchema,
  purchaseProductQuerySchema,
  updatePurchaseBillSchema,
} from "../validators/purchase-bill.validators";

export class PurchaseBillController {
  private service: PurchaseBillService;

  constructor(service: PurchaseBillService = purchaseBillService) {
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
   * GET /api/v1/purchases/next-number
   */
  getNextNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getNextNumber(businessId);
    return SuccessResponse(res, "Next purchase number generated", result, 200);
  });

  /**
   * GET /api/v1/purchases/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(res, "Purchase metrics retrieved successfully", metrics, 200);
  });

  /**
   * GET /api/v1/purchases/products
   * Product listing for purchase bill — includes category / subCategory grouping
   */
  getProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = purchaseProductQuerySchema.parse(req.query);
    const result = await this.service.getProducts(businessId, query);
    return SuccessResponse(
      res,
      "Purchase products retrieved successfully",
      result,
      200
    );
  });

  /**
   * GET /api/v1/purchases/products/categories
   */
  getProductCategories = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const result = await this.service.getProductCategories(businessId);
      return SuccessResponse(
        res,
        "Product categories retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * POST /api/v1/purchases/products
   * Create product from purchase bill screen (name, category, subcategory, rate, GST, etc.)
   */
  createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = createPurchaseProductSchema.parse(req.body);
    const product = await this.service.createProduct(businessId, input);
    return SuccessResponse(
      res,
      `Product "${product.name}" created successfully`,
      product,
      201
    );
  });

  /**
   * POST /api/v1/purchases
   * Create purchase bill (draft or confirmed)
   */
  createPurchaseBill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const input = createPurchaseBillSchema.parse(req.body);
      const purchase = await this.service.createPurchaseBill(businessId, input);
      return SuccessResponse(
        res,
        purchase.isConfirmed
          ? "Purchase bill confirmed and stock updated successfully"
          : "Purchase bill draft saved successfully",
        purchase,
        201
      );
    }
  );

  /**
   * GET /api/v1/purchases
   */
  getPurchaseBills = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const query = purchaseBillQuerySchema.parse(req.query);
      const result = await this.service.getPurchaseBills(businessId, query);
      return SuccessResponse(
        res,
        "Purchase bills retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * GET /api/v1/purchases/:id
   */
  getPurchaseBillById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase ID is required", 400);
      const purchase = await this.service.getPurchaseBillById(businessId, id);
      return SuccessResponse(
        res,
        "Purchase bill details retrieved successfully",
        purchase,
        200
      );
    }
  );

  /**
   * PUT/PATCH /api/v1/purchases/:id
   */
  updatePurchaseBill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase ID is required", 400);
      const input = updatePurchaseBillSchema.parse(req.body);
      const purchase = await this.service.updatePurchaseBill(businessId, id, input);
      return SuccessResponse(
        res,
        "Purchase bill updated successfully",
        purchase,
        200
      );
    }
  );

  /**
   * POST /api/v1/purchases/:id/confirm
   * Confirm draft and add stock
   */
  confirmPurchaseBill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase ID is required", 400);
      const purchase = await this.service.confirmPurchaseBill(businessId, id);
      return SuccessResponse(
        res,
        "Purchase bill confirmed and inventory updated successfully",
        purchase,
        200
      );
    }
  );

  /**
   * POST /api/v1/purchases/:id/cancel
   */
  cancelPurchaseBill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase ID is required", 400);
      const purchase = await this.service.cancelPurchaseBill(businessId, id);
      return SuccessResponse(
        res,
        "Purchase bill cancelled successfully",
        purchase,
        200
      );
    }
  );

  /**
   * DELETE /api/v1/purchases/:id
   */
  deletePurchaseBill = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const id = req.params.id as string;
      if (!id) throw new ErrorResponse("Purchase ID is required", 400);
      const result = await this.service.deletePurchaseBill(businessId, id);
      return SuccessResponse(res, result.message, result, 200);
    }
  );
}

export const purchaseBillController = new PurchaseBillController();
