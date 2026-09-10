import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { upload } from "../../../../middlewares/upload.middleware";
import { productController } from "../controllers/product.controller";

const router = Router();

// Protect all product endpoints with JWT authentication
router.use(protect);

/**
 * Product Master & Inventory Routes
 */
// Create new product
router.post("/", productController.createProduct);

// Upload product image to Cloudinary (standalone upload)
router.post(
  "/upload-image",
  upload.single("image"),
  productController.uploadProductImage
);

// List / search / filter products directory
router.get("/", productController.getProducts);

// Aggregate metrics summary for product catalogue
router.get("/metrics/summary", productController.getProductMetrics);

// High-speed barcode / SKU lookup for POS Billing
router.get("/barcode/:barcode", productController.findProductByBarcode);

// Single product details
router.get("/:id", productController.getProductById);

// Upload and attach image to an existing product
router.post(
  "/:id/image",
  upload.single("image"),
  productController.uploadProductImageById
);

// Update product
router.put("/:id", productController.updateProduct);
router.patch("/:id", productController.updateProduct);

// Delete product (smart soft/hard delete)
router.delete("/:id", productController.deleteProduct);

export default router;
export { router as productRouter };
