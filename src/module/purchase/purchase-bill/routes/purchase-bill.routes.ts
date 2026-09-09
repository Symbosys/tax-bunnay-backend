import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { purchaseBillController } from "../controllers/purchase-bill.controller";

const router = Router();

router.use(protect);

/**
 * Static / utility routes (must be registered before /:id)
 */
router.get("/next-number", purchaseBillController.getNextNumber);
router.get("/metrics/summary", purchaseBillController.getMetrics);

/**
 * Product listing inside purchase bill flow
 * (categories, sub-categories, quantity/rate/discount master fields)
 */
router.get("/products/categories", purchaseBillController.getProductCategories);
router.get("/products", purchaseBillController.getProducts);
router.post("/products", purchaseBillController.createProduct);

/**
 * Purchase bill CRUD
 */
router.post("/", purchaseBillController.createPurchaseBill);
router.get("/", purchaseBillController.getPurchaseBills);
router.get("/:id", purchaseBillController.getPurchaseBillById);
router.put("/:id", purchaseBillController.updatePurchaseBill);
router.patch("/:id", purchaseBillController.updatePurchaseBill);
router.post("/:id/confirm", purchaseBillController.confirmPurchaseBill);
router.post("/:id/cancel", purchaseBillController.cancelPurchaseBill);
router.delete("/:id", purchaseBillController.deletePurchaseBill);

export default router;
export { router as purchaseBillRouter };
