import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { expenseController } from "../controllers/expense.controller";

const router = Router();

// Protect all expense routes with JWT authentication
router.use(protect);

/**
 * 1. Analytics & Metadata endpoints (must be before /:id)
 */
router.get("/summary", expenseController.getExpenseSummary);
router.get("/categories", expenseController.getCategories);

/**
 * 2. Expense Collection endpoints
 */
router.get("/", expenseController.getExpenses);
router.post("/", expenseController.createExpense);

/**
 * 3. Single Expense Member endpoints
 */
router.get("/:id", expenseController.getExpenseById);
router.put("/:id", expenseController.updateExpense);
router.patch("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

export default router;
export { router as expenseRouter };
