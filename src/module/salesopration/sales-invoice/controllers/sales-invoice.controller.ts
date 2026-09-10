import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import {
  salesInvoiceService,
  SalesInvoiceService,
} from "../services/sales-invoice.service";
import {
  createSalesInvoiceSchema,
  holdSalesInvoiceSchema,
  invoiceStatusSchema,
  salesInvoiceQuerySchema,
  updateSalesInvoiceSchema,
} from "../validators/sales-invoice.validators";

export class SalesInvoiceController {
  private service: SalesInvoiceService;

  constructor(service: SalesInvoiceService = salesInvoiceService) {
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
   * GET /api/v1/sales/invoices/next-number
   */
  getNextNumber = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getNextNumber(businessId);
    return SuccessResponse(res, "Next invoice number generated", result, 200);
  });

  /**
   * GET /api/v1/sales/invoices/metrics/summary
   */
  getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const metrics = await this.service.getMetrics(businessId);
    return SuccessResponse(res, "Sales metrics retrieved successfully", metrics, 200);
  });

  /**
   * POST /api/v1/sales/invoices
   */
  createInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validated = createSalesInvoiceSchema.parse(req.body);
    const userId = req.user?.id;
    const cashierName = req.user?.name || req.user?.email || "Counter 1";

    const result = await this.service.createInvoice(
      businessId,
      validated,
      userId,
      cashierName
    );

    return SuccessResponse(
      res,
      `Sales invoice ${result.invoice.invoiceNumber} created successfully`,
      result,
      201
    );
  });

  /**
   * GET /api/v1/sales/invoices
   */
  getInvoices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const query = salesInvoiceQuerySchema.parse(req.query);
    const result = await this.service.getInvoices(businessId, query);
    return SuccessResponse(res, "Sales invoices retrieved successfully", result, 200);
  });

  /**
   * GET /api/v1/sales/invoices/held/list
   */
  getHeldInvoices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const result = await this.service.getHeldInvoices(businessId);
    return SuccessResponse(res, "Held bills retrieved successfully", result, 200);
  });

  /**
   * POST /api/v1/sales/invoices/hold
   */
  holdInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validated = holdSalesInvoiceSchema.parse(req.body);
    const userId = req.user?.id;

    const result = await this.service.holdInvoice(businessId, validated, userId);
    return SuccessResponse(res, "Bill held successfully", result, 201);
  });

  /**
   * POST /api/v1/sales/invoices/held/:id/resume
   */
  resumeHeldInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const result = await this.service.resumeHeldInvoice(businessId, id);
    return SuccessResponse(res, "Held bill resumed successfully", result, 200);
  });

  /**
   * GET /api/v1/sales/invoices/:id
   */
  getInvoiceById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const cashierName = req.user?.name || req.user?.email || "Counter 1";
    const result = await this.service.getInvoiceById(businessId, id, cashierName);
    return SuccessResponse(res, "Invoice retrieved successfully", result, 200);
  });

  /**
   * GET /api/v1/sales/invoices/:id/receipt
   */
  getThermalReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const cashierName = req.user?.name || req.user?.email || "Counter 1";
    const invoice = await this.service.getInvoiceById(businessId, id, cashierName);
    return SuccessResponse(res, "Thermal receipt payload generated", invoice.receipt, 200);
  });

  /**
   * PUT / PATCH /api/v1/sales/invoices/:id
   */
  updateInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const validated = updateSalesInvoiceSchema.parse(req.body);
    const userId = req.user?.id;

    const result = await this.service.updateInvoice(
      businessId,
      id,
      validated,
      userId
    );
    return SuccessResponse(res, "Invoice updated successfully", result, 200);
  });

  /**
   * PATCH /api/v1/sales/invoices/:id/status
   */
  updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;
    const status = invoiceStatusSchema.parse(req.body.status);

    const result = await this.service.updateStatus(businessId, id, status);
    return SuccessResponse(res, `Invoice status updated to ${status}`, result, 200);
  });

  /**
   * POST /api/v1/sales/invoices/:id/cancel
   */
  cancelInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const result = await this.service.cancelInvoice(businessId, id);
    return SuccessResponse(res, "Sales invoice cancelled successfully", result, 200);
  });

  /**
   * DELETE /api/v1/sales/invoices/:id
   */
  deleteInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const id = req.params.id as string;

    const result = await this.service.deleteInvoice(businessId, id);
    return SuccessResponse(res, "Invoice deleted successfully", result, 200);
  });
}

export const salesInvoiceController = new SalesInvoiceController();
