import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { salesReturnController } from "../controllers/sales-return.controller";

const router = Router();

// Protect all sales return endpoints with JWT authentication
router.use(protect);

/**
 * Static / Utility endpoints (must precede `/:id`)
 */
router.get("/next-number", salesReturnController.getNextNumber);
router.get("/metrics/summary", salesReturnController.getMetrics);

/**
 * Core Sales Return CRUD & Actions
 */
router.post("/", salesReturnController.createSalesReturn);
router.get("/", salesReturnController.getSalesReturns);
router.get("/:id", salesReturnController.getSalesReturnById);
router.get("/:id/receipt", salesReturnController.getThermalReceipt);
router.put("/:id", salesReturnController.updateSalesReturn);
router.patch("/:id", salesReturnController.updateSalesReturn);
router.patch("/:id/status", salesReturnController.updateStatus);
router.post("/:id/confirm", salesReturnController.confirmSalesReturn);
router.post("/:id/cancel", salesReturnController.cancelSalesReturn);
router.delete("/:id", salesReturnController.deleteSalesReturn);

export default router;
export { router as salesReturnRouter };
