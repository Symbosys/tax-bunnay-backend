import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { outstandingController } from "../controllers/outstanding.controller";

const outstandingRouter = Router();

// Protect all outstanding analysis endpoints with JWT authentication & tenant checks
outstandingRouter.use(protect);

/**
 * @route   GET /api/v1/outstanding/summary
 * @desc    Get high-level outstanding summary & ageing metrics
 * @access  Private
 */
outstandingRouter.get("/summary", outstandingController.getOutstandingSummary);

/**
 * @route   GET /api/v1/outstanding/receivables
 * @desc    Get detailed customer invoice receivables list with ageing
 * @access  Private
 */
outstandingRouter.get("/receivables", outstandingController.getReceivables);

/**
 * @route   GET /api/v1/outstanding/payables
 * @desc    Get detailed supplier purchase payables list with ageing
 * @access  Private
 */
outstandingRouter.get("/payables", outstandingController.getPayables);

/**
 * @route   GET /api/v1/outstanding/party/:type/:id
 * @desc    Get party specific outstanding overview (customer or supplier)
 * @access  Private
 */
outstandingRouter.get("/party/:type/:id", outstandingController.getPartyOutstanding);

export { outstandingRouter };
