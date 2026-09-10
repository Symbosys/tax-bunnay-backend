import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../../middlewares/error.middleware";
import { ErrorResponse, SuccessResponse } from "../../../../utils/response.util";
import { productService, ProductService } from "../services/product.service";
import {
  createProductSchema,
  productQuerySchema,
  updateProductSchema,
} from "../validators/product.validators";

export class ProductController {
  private service: ProductService;

  constructor(service: ProductService = productService) {
    this.service = service;
  }

  /**
   * Helper to resolve active Business ID from headers, queries, body, or user session
   */
  private extractBusinessId(req: AuthenticatedRequest): string {
    // 1. From 'X-Business-ID' header
    const headerId = (req.headers["x-business-id"] ||
      req.headers["X-Business-ID"]) as string;
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

    if (
      req.user?.businessMemberships &&
      req.user.businessMemberships.length > 0
    ) {
      return req.user.businessMemberships[0].businessId;
    }

    throw new ErrorResponse(
      "Business ID is required. Please pass 'X-Business-ID' header or ensure you have selected an active business.",
      400
    );
  }

  /**
   * Create a new Product
   * POST /api/v1/products
   */
  createProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedData = createProductSchema.parse(req.body);

      const product = await this.service.createProduct(
        businessId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Product "${product.name}" created successfully`,
        product,
        201
      );
    }
  );

  /**
   * Search, filter, and paginate Products directory
   * GET /api/v1/products
   */
  getProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const validatedQuery = productQuerySchema.parse(req.query);

      const result = await this.service.getProducts(
        businessId,
        validatedQuery
      );

      return SuccessResponse(
        res,
        "Products retrieved successfully",
        result,
        200
      );
    }
  );

  /**
   * Get single Product by ID
   * GET /api/v1/products/:id
   */
  getProductById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const productId = req.params.id as string;

      if (!productId) {
        throw new ErrorResponse("Product ID parameter is required", 400);
      }

      const product = await this.service.getProductById(
        businessId,
        productId
      );

      return SuccessResponse(
        res,
        "Product details retrieved successfully",
        product,
        200
      );
    }
  );

  /**
   * High-speed barcode lookup for POS scanner
   * GET /api/v1/products/barcode/:barcode
   */
  findProductByBarcode = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const barcode = req.params.barcode as string;

      if (!barcode) {
        throw new ErrorResponse("Barcode parameter is required", 400);
      }

      const product = await this.service.findProductByBarcode(
        businessId,
        barcode
      );

      if (!product) {
        return SuccessResponse(
          res,
          `Product with barcode "${barcode}" is not listed yet`,
          null,
          200
        );
      }

      return SuccessResponse(
        res,
        `Product found for barcode "${barcode}"`,
        product,
        200
      );
    }
  );

  /**
   * Update existing Product
   * PUT/PATCH /api/v1/products/:id
   */
  updateProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const productId = req.params.id as string;

      if (!productId) {
        throw new ErrorResponse("Product ID parameter is required", 400);
      }

      const validatedData = updateProductSchema.parse(req.body);
      const updated = await this.service.updateProduct(
        businessId,
        productId,
        validatedData
      );

      return SuccessResponse(
        res,
        `Product "${updated.name}" updated successfully`,
        updated,
        200
      );
    }
  );

  /**
   * Delete or archive Product
   * DELETE /api/v1/products/:id
   */
  deleteProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const productId = req.params.id as string;

      if (!productId) {
        throw new ErrorResponse("Product ID parameter is required", 400);
      }

      const result = await this.service.deleteProduct(businessId, productId);

      return SuccessResponse(res, result.message, result, 200);
    }
  );

  /**
   * Get Product Directory Aggregate Metrics
   * GET /api/v1/products/metrics/summary
   */
  getProductMetrics = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const metrics = await this.service.getMetrics(businessId);

      return SuccessResponse(
        res,
        "Product directory metrics retrieved successfully",
        metrics,
        200
      );
    }
  );

  /**
   * Upload Product Image (Standalone)
   * POST /api/v1/products/upload-image
   */
  uploadProductImage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const fileBuffer = req.file?.buffer;
      const dataUri = (req.body?.imageBase64 || req.body?.dataUri || req.body?.imageUrl) as string | undefined;
      const productId = (req.body?.productId as string) || undefined;

      if (!fileBuffer && !dataUri) {
        throw new ErrorResponse(
          "Please upload an image file using multipart/form-data ('image' field) or provide 'imageBase64'/'dataUri' in request body",
          400
        );
      }

      const result = await this.service.uploadProductImage(
        businessId,
        fileBuffer,
        dataUri,
        productId
      );

      return SuccessResponse(
        res,
        "Product image uploaded to Cloudinary successfully",
        result,
        200
      );
    }
  );

  /**
   * Upload and attach image to an existing Product
   * POST /api/v1/products/:id/image
   */
  uploadProductImageById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const businessId = this.extractBusinessId(req);
      const productId = req.params.id as string;
      const fileBuffer = req.file?.buffer;
      const dataUri = (req.body?.imageBase64 || req.body?.dataUri || req.body?.imageUrl) as string | undefined;

      if (!productId) {
        throw new ErrorResponse("Product ID parameter is required", 400);
      }

      if (!fileBuffer && !dataUri) {
        throw new ErrorResponse(
          "Please upload an image file using multipart/form-data ('image' field) or provide 'imageBase64'/'dataUri' in request body",
          400
        );
      }

      const result = await this.service.uploadProductImage(
        businessId,
        fileBuffer,
        dataUri,
        productId
      );

      return SuccessResponse(
        res,
        "Product image uploaded and attached successfully",
        result,
        200
      );
    }
  );
}

export const productController = new ProductController();
