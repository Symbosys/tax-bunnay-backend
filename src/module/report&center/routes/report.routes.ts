import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { reportController } from "../controllers/report.controller";

const router = Router();

// Protect all report center routes with JWT authentication
router.use(protect);

/**
 * 1. Catalog & Overview
 */
router.get("/catalog", reportController.getReportsCatalog);
router.get("/overview", reportController.getReportsCatalog);

/**
 * 2. Standard Business Reports (Matching reports_page.dart tabs)
 */
router.get("/sales-register", reportController.getSalesRegister);
router.get("/sales", reportController.getSalesRegister);

router.get("/purchase-register", reportController.getPurchaseRegister);
router.get("/purchases", reportController.getPurchaseRegister);

router.get("/gst-summary", reportController.getGstSummary);
router.get("/gst", reportController.getGstSummary);

router.get("/stock-valuation", reportController.getStockValuation);
router.get("/stock", reportController.getStockValuation);

/**
 * 3. Export Operations & History
 */
router.post("/export", reportController.exportReport);
router.get("/exports", reportController.getExportHistory);

/**
 * 4. Saved Reports & Presets
 */
router.get("/saved", reportController.getSavedReports);
router.post("/saved", reportController.createSavedReport);
router.delete("/saved/:id", reportController.deleteSavedReport);

export default router;
export { router as reportCenterRouter, router as reportRouter };
