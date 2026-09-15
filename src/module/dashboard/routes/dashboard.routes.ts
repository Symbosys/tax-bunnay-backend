import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { dashboardController } from "../controllers/dashboard.controller";

const router = Router();

// Secure all dashboard endpoints
router.use(protect);

/**
 * Core Dashboard Endpoints
 */
router.get("/overview", dashboardController.getOverview);
router.get("/metrics", dashboardController.getMetrics);
router.get("/trends", dashboardController.getTrends);
router.get("/cash-bank", dashboardController.getCashBank);
router.get("/inventory-summary", dashboardController.getInventorySummary);
router.get("/recent-sales", dashboardController.getRecentSales);
router.get("/recent-purchases", dashboardController.getRecentPurchases);
router.get("/reminders", dashboardController.getReminders);

// Root route aliases to full overview
router.get("/", dashboardController.getOverview);

export default router;
export { router as dashboardRouter };
