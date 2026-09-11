import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { stockValuationController } from "../controllers/stock-valuation.controller";

const stockValuationRouter = Router();

stockValuationRouter.use(protect);

/**
 * @route   GET /api/v1/inventory/stock-valuation/summary
 * @desc    Stock valuation KPIs (total value, low stock, SKU counts)
 * @access  Private
 */
stockValuationRouter.get("/summary", stockValuationController.getSummary);

/**
 * @route   GET /api/v1/inventory/stock-valuation/items
 * @desc    Stock summary rows with purchase-price based valuation
 * @access  Private
 */
stockValuationRouter.get("/items", stockValuationController.getItems);

/**
 * @route   GET /api/v1/inventory/stock-valuation/movements
 * @desc    Stock ledger / movement history
 * @access  Private
 */
stockValuationRouter.get("/movements", stockValuationController.getMovements);

/**
 * @route   POST /api/v1/inventory/stock-valuation/adjustment
 * @desc    Manual stock adjustment (positive = in, negative = out)
 * @access  Private
 */
stockValuationRouter.post(
  "/adjustment",
  stockValuationController.createAdjustment
);

export { stockValuationRouter };
