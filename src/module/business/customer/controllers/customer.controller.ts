import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { customerService, CustomerService } from "../services/customer.service";
import {
  createCustomerSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from "../validators/customer.validators";

export class CustomerController {
  private service: CustomerService;

  constructor(service: CustomerService = customerService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    // 1. From 'X-Business-ID' header (case-insensitive check)
    const headerId = (req.headers["x-business-id"] || req.headers["X-Business-ID"]) as string;
    if (headerId && headerId.trim().length > 0) {
      return headerId.trim();
    }

    // 2. From Query parameter
    if (req.query.businessId && typeof req.query.businessId === "string") {
      return req.query.businessId.trim();
    }

    // 3. From Request Body
    if (req.body?.businessId && typeof req.body.businessId === "string") {
      return req.body.businessId.trim();
    }

    // 4. Fallback to Authenticated User's first owned business or membership
    if (req.user?.ownedBusinesses && req.user.ownedBusinesses.length > 0) {
      return req.user.ownedBusinesses[0].id;
    }

    if (req.user?.businessMemberships && req.user.businessMemberships.length > 0) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or ensure you have selected an active business.",
      400
    );
  }

  /**
   * Create a new Customer
   * POST /api/v1/customers or POST /api/v1/business/customers
   */
  createCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedData = createCustomerSchema.parse(req.body);

    const customer = await this.service.createCustomer(businessId, validatedData);

    return SuccessResponse(
      res,
      `Customer "${customer.name}" created successfully`,
      customer,
      201
    );
  });

  /**
   * Search, filter, and paginate Customer directory
   * GET /api/v1/customers or GET /api/v1/business/customers
   */
  getCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const validatedQuery = customerQuerySchema.parse(req.query);

    const result = await this.service.getCustomers(businessId, validatedQuery);

    return SuccessResponse(
      res,
      "Customers retrieved successfully",
      result,
      200
    );
  });

  /**
   * Get single Customer profile with detailed history
   * GET /api/v1/customers/:id or GET /api/v1/business/customers/:id
   */
  getCustomerById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const customerId = req.params.id as string;

    if (!customerId) {
      throw new ErrorResponse("Customer ID parameter is required", 400);
    }

    const customer = await this.service.getCustomerById(businessId, customerId);

    return SuccessResponse(
      res,
      "Customer details retrieved successfully",
      customer,
      200
    );
  });

  /**
   * Update existing Customer
   * PUT/PATCH /api/v1/customers/:id or PUT/PATCH /api/v1/business/customers/:id
   */
  updateCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const customerId = req.params.id as string;

    if (!customerId) {
      throw new ErrorResponse("Customer ID parameter is required", 400);
    }

    const validatedData = updateCustomerSchema.parse(req.body);
    const updated = await this.service.updateCustomer(businessId, customerId, validatedData);

    return SuccessResponse(
      res,
      `Customer "${updated.name}" updated successfully`,
      updated,
      200
    );
  });

  /**
   * Delete or archive Customer
   * DELETE /api/v1/customers/:id or DELETE /api/v1/business/customers/:id
   */
  deleteCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);
    const customerId = req.params.id as string;

    if (!customerId) {
      throw new ErrorResponse("Customer ID parameter is required", 400);
    }

    const result = await this.service.deleteCustomer(businessId, customerId);

    return SuccessResponse(res, result.message, result, 200);
  });

  /**
   * Get Customer Directory Aggregate Metrics
   * GET /api/v1/customers/metrics/summary or GET /api/v1/business/customers/metrics/summary
   */
  getCustomerMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessId = this.extractBusinessId(req);

    const metrics = await this.service.getMetrics(businessId);

    return SuccessResponse(
      res,
      "Customer metrics retrieved successfully",
      metrics,
      200
    );
  });
}

export const customerController = new CustomerController();
