import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { financialStatementsController } from "../controllers/financial-statements.controller";

const router = Router();

// Require authentication for all routes
router.use(protect);

/**
 * Financial Statements Routes
 */
// 1. Get full statement (P&L, Balance Sheet, Cash Flow, Equity Changes)
router.get("/", financialStatementsController.getFinancialStatement);

// 2. Get financial summary & donut breakdown
router.get("/summary", financialStatementsController.getFinancialSummary);

// 3. Get profit trend data points
router.get("/trend", financialStatementsController.getProfitTrend);

// 4. Get available report types cards metadata
router.get("/report-types", financialStatementsController.getAvailableReportTypes);

// 5. Create custom report
router.post("/custom-report", financialStatementsController.createCustomReport);

// 6. Schedule report delivery
router.post("/schedule", financialStatementsController.scheduleReport);

// 7. Save layout preset
router.post("/save-layout", financialStatementsController.saveLayout);

// 8. Export statement (CSV / JSON)
router.get("/export", financialStatementsController.exportStatement);

export const financialStatementsRouter = router;
