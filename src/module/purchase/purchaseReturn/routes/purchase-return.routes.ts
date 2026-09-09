import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { purchaseReturnController } from "../controllers/purchase-return.controller";

const router = Router();

router.use(protect);

/**
 * Static / utility routes (must be registered before /:id)
 */
router.get("/next-number", purchaseReturnController.getNextNumber);
router.get("/metrics/summary", purchaseReturnController.getMetrics);
router.get("/eligible-purchases", purchaseReturnController.getEligiblePurchases);
router.get(
  "/purchases/:purchaseId/items",
  purchaseReturnController.getReturnableItems
);

/**
 * Purchase return / debit note CRUD
 */
router.post("/", purchaseReturnController.createPurchaseReturn);
router.get("/", purchaseReturnController.getPurchaseReturns);
router.get("/:id", purchaseReturnController.getPurchaseReturnById);
router.put("/:id", purchaseReturnController.updatePurchaseReturn);
router.patch("/:id", purchaseReturnController.updatePurchaseReturn);
router.post("/:id/confirm", purchaseReturnController.confirmPurchaseReturn);
router.patch("/:id/status", purchaseReturnController.updateStatus);
router.post("/:id/cancel", purchaseReturnController.cancelPurchaseReturn);
router.delete("/:id", purchaseReturnController.deletePurchaseReturn);

export default router;
export { router as purchaseReturnRouter };
