import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { bankAccountController } from "../controllers/bank-account.controller";

const router = Router();

// Protect all bank account routes with JWT authentication
router.use(protect);

/**
 * 1. Bank Accounts List & KPI summaries with filtering & pagination
 */
router.get("/", bankAccountController.getBankAccounts);

/**
 * 2. Summary KPIs & Donut Chart Breakdown
 */
router.get("/summary", bankAccountController.getBankSummary);

/**
 * 3. Recent Bank Transactions
 */
router.get("/recent-transactions", bankAccountController.getRecentTransactions);

/**
 * 4. Export Bank Accounts to CSV
 */
router.get("/export", bankAccountController.exportBankAccounts);

/**
 * 5. Single Bank Account Detail
 */
router.get("/:id", bankAccountController.getAccountDetail);

/**
 * 6. Create Bank Account
 */
router.post("/", bankAccountController.createBankAccount);

/**
 * 7. Update Bank Account
 */
router.put("/:id", bankAccountController.updateBankAccount);

/**
 * 8. Delete Bank Account
 */
router.delete("/:id", bankAccountController.deleteBankAccount);

/**
 * 9. Toggle Active / Inactive Status
 */
router.post("/:id/toggle-status", bankAccountController.toggleStatus);

/**
 * 10. Reconcile Bank Account
 */
router.post("/:id/reconcile", bankAccountController.reconcileAccount);

export default router;
export { router as bankAccountRouter };
