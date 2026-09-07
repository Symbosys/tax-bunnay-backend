import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util";
import { posService, PosService } from "../services/pos.service";
import {
  closePosSessionSchema,
  holdPosCartSchema,
  openPosSessionSchema,
  posCheckoutSchema,
  posProductQuerySchema,
  quickCustomerSchema,
} from "../validators/pos.validators";

export class PosController {
  private service: PosService;

  constructor(service: PosService = posService) {
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

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or select an active business.",
      400
    );
  }

  /**
   * 1. Get POS Product Catalog with Stock
   * GET /api/v1/pos/products
   */
  getProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = posProductQuerySchema.parse(req.query);

    const result = await this.service.getProducts(businessId, query);
    return SuccessResponse(res, "POS products retrieved successfully", result, 200);
  });

  /**
   * 2. High-speed barcode / SKU scanner lookup
   * GET /api/v1/pos/products/scan/:barcode
   */
  scanBarcode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const barcode = req.params.barcode as string;

    const product = await this.service.scanBarcode(businessId, barcode);
    return SuccessResponse(res, "Product scanned successfully", product, 200);
  });

  /**
   * 3. Customer directory lookup for POS
   * GET /api/v1/pos/customers
   */
  getCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const search = req.query.search as string | undefined;

    const customers = await this.service.getCustomers(businessId, search);
    return SuccessResponse(res, "Customers retrieved successfully", customers, 200);
  });

  /**
   * 4. Quick customer creation from POS terminal counter
   * POST /api/v1/pos/customers/quick
   */
  quickCreateCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = quickCustomerSchema.parse(req.body);

    const customer = await this.service.quickCreateCustomer(businessId, input);
    return SuccessResponse(res, `Customer "${customer.name}" created successfully`, customer, 201);
  });

  /**
   * 5. Open POS Register Session
   * POST /api/v1/pos/session/open
   */
  openSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = openPosSessionSchema.parse(req.body);
    const userId = req.user?.id;
    const cashierName = req.user?.name || req.user?.email || "Cashier";

    const result = await this.service.openSession(businessId, input, userId, cashierName);
    return SuccessResponse(res, result.message, result.session, 200);
  });

  /**
   * 6. Get Active POS Register Session
   * GET /api/v1/pos/session/active
   */
  getActiveSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const userId = req.user?.id;

    const session = await this.service.getActiveSession(businessId, userId);
    return SuccessResponse(
      res,
      session ? "Active POS session retrieved" : "No active session currently open",
      session,
      200
    );
  });

  /**
   * 7. Close POS Register Session
   * POST /api/v1/pos/session/close
   */
  closeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = closePosSessionSchema.parse(req.body);
    const userId = req.user?.id;

    const result = await this.service.closeSession(businessId, input, userId);
    return SuccessResponse(res, result.message, result.summary, 200);
  });

  /**
   * 8. Get POS Register Sessions History
   * GET /api/v1/pos/session/history
   */
  getSessionHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);

    const history = await this.service.getSessionHistory(businessId);
    return SuccessResponse(res, "POS sessions history retrieved", history, 200);
  });

  /**
   * 9. Process POS Checkout / Sale Transaction
   * POST /api/v1/pos/checkout
   */
  checkout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = posCheckoutSchema.parse(req.body);
    const userId = req.user?.id;
    const cashierName = req.user?.name || req.user?.email || "Cashier";

    const result = await this.service.processCheckout(businessId, input, userId, cashierName);
    return SuccessResponse(
      res,
      `Sale completed! Invoice ${result.invoice.invoiceNumber} created.`,
      result,
      201
    );
  });

  /**
   * 10. Park / Hold current POS cart
   * POST /api/v1/pos/cart/hold
   */
  holdCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const input = holdPosCartSchema.parse(req.body);
    const userId = req.user?.id;

    const result = await this.service.holdCart(businessId, input, userId);
    return SuccessResponse(res, result.message, result.heldCart, 201);
  });

  /**
   * 11. List all parked / held carts
   * GET /api/v1/pos/cart/held
   */
  getHeldCarts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);

    const carts = await this.service.getHeldCarts(businessId);
    return SuccessResponse(res, "Held carts retrieved successfully", carts, 200);
  });

  /**
   * 12. Resume a parked cart
   * POST /api/v1/pos/cart/resume/:id
   */
  resumeCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const cartId = req.params.id as string;

    const result = await this.service.resumeHeldCart(businessId, cartId);
    return SuccessResponse(res, result.message, result.cart, 200);
  });

  /**
   * 13. Delete a parked cart
   * DELETE /api/v1/pos/cart/held/:id
   */
  deleteHeldCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const cartId = req.params.id as string;

    const result = await this.service.deleteHeldCart(businessId, cartId);
    return SuccessResponse(res, result.message, null, 200);
  });

  /**
   * 14. Get formatted 80mm thermal receipt payload
   * GET /api/v1/pos/receipt/:invoiceId
   */
  getReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const invoiceId = req.params.invoiceId as string;
    const cashierName = req.user?.name || req.user?.email || "Cashier";

    const receipt = await this.service.getReceipt(businessId, invoiceId, cashierName);
    return SuccessResponse(res, "Receipt generated successfully", receipt, 200);
  });

  /**
   * 15. Daily POS Sales and Register Summary
   * GET /api/v1/pos/dashboard/summary
   */
  getDashboardSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);

    const summary = await this.service.getDashboardSummary(businessId);
    return SuccessResponse(res, "POS dashboard summary retrieved", summary, 200);
  });
}

export const posController = new PosController();
