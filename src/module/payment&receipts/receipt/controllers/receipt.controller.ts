import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { receiptService, ReceiptService } from "../services/receipt.service";
import { createReceiptSchema, receiptQuerySchema } from "../validators/receipt.validators";

export class ReceiptController {
  private service: ReceiptService;

  constructor(service: ReceiptService = receiptService) {
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
   * Record a new customer receipt
   * POST /api/v1/receipts
   */
  createReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = createReceiptSchema.parse(req.body);

    const receipt = await this.service.createReceipt(businessId, validatedData);
    return SuccessResponse(res, "Receipt recorded successfully", receipt, 201);
  });

  /**
   * List customer receipts with filtering and pagination
   * GET /api/v1/receipts
   */
  getReceipts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const queryParams = receiptQuerySchema.parse(req.query);

    const result = await this.service.getReceipts(businessId, queryParams);
    return SuccessResponse(res, "Receipts retrieved successfully", result, 200);
  });

  /**
   * Get receipt summary & performance metrics
   * GET /api/v1/receipts/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(res, "Receipt metrics retrieved successfully", metrics, 200);
  });

  /**
   * Get auto-generated next receipt reference number
   * GET /api/v1/receipts/next-ref
   */
  getNextReferenceNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const data = await this.service.getNextReferenceNumber(businessId);
    return SuccessResponse(res, "Next receipt reference generated successfully", data, 200);
  });

  /**
   * Get unpaid invoices for a specific customer (powers ReceiptEntryPage dropdown)
   * GET /api/v1/receipts/customer/:customerId/unpaid-invoices
   */
  getUnpaidInvoicesByCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const customerId = req.params.customerId as string;

    if (!customerId) {
      throw new ErrorResponse("Customer ID is required", 400);
    }

    const invoices = await this.service.getUnpaidInvoicesByCustomer(businessId, customerId);
    return SuccessResponse(res, "Unpaid invoices retrieved successfully", invoices, 200);
  });

  /**
   * Get single receipt details by ID
   * GET /api/v1/receipts/:id
   */
  getReceiptById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const receipt = await this.service.getReceiptById(businessId, id);
    return SuccessResponse(res, "Receipt details retrieved successfully", receipt, 200);
  });

  /**
   * Delete a receipt and revert invoice statuses
   * DELETE /api/v1/receipts/:id
   */
  deleteReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const deleted = await this.service.deleteReceipt(businessId, id);
    return SuccessResponse(res, "Receipt deleted successfully", deleted, 200);
  });
}

export const receiptController = new ReceiptController();
