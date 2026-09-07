import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { paymentEntryService, PaymentEntryService } from "../services/payment-entry.service";
import { createPaymentSchema, paymentQuerySchema } from "../validators/payment-entry.validators";

export class PaymentEntryController {
  private service: PaymentEntryService;

  constructor(service: PaymentEntryService = paymentEntryService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
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
   * Record a new supplier payment
   * POST /api/v1/payments
   */
  createPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = createPaymentSchema.parse(req.body);

    const payment = await this.service.createPayment(businessId, validatedData);
    return SuccessResponse(res, "Payment recorded successfully", payment, 201);
  });

  /**
   * List supplier payments with filtering and pagination
   * GET /api/v1/payments
   */
  getPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const queryParams = paymentQuerySchema.parse(req.query);

    const result = await this.service.getPayments(businessId, queryParams);
    return SuccessResponse(res, "Payments retrieved successfully", result, 200);
  });

  /**
   * Get payment KPI summary metrics
   * GET /api/v1/payments/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(res, "Payment metrics retrieved successfully", metrics, 200);
  });

  /**
   * Get auto-generated next payment reference code / transaction ID
   * GET /api/v1/payments/next-ref
   */
  getNextReferenceNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const data = await this.service.getNextReferenceNumber(businessId);
    return SuccessResponse(res, "Next payment reference generated successfully", data, 200);
  });

  /**
   * Get unpaid purchases for a supplier (powers PaymentEntryPage bill allocation table)
   * GET /api/v1/payments/supplier/:supplierId/unpaid-purchases
   */
  getUnpaidPurchasesBySupplier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const supplierId = req.params.supplierId as string;

    if (!supplierId) {
      throw new ErrorResponse("Supplier ID is required", 400);
    }

    const purchases = await this.service.getUnpaidPurchasesBySupplier(businessId, supplierId);
    return SuccessResponse(res, "Unpaid purchases retrieved successfully", purchases, 200);
  });

  /**
   * Get single payment details by ID
   * GET /api/v1/payments/:id
   */
  getPaymentById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const payment = await this.service.getPaymentById(businessId, id);
    return SuccessResponse(res, "Payment details retrieved successfully", payment, 200);
  });

  /**
   * Delete a payment and revert purchase status
   * DELETE /api/v1/payments/:id
   */
  deletePayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const deleted = await this.service.deletePayment(businessId, id);
    return SuccessResponse(res, "Payment deleted successfully", deleted, 200);
  });
}

export const paymentEntryController = new PaymentEntryController();
