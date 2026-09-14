import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { chartAccountController } from "../controllers/chart-account.controller";

const router = Router();

// Protect all chart of accounts routes with JWT authentication
router.use(protect);

/**
 * 1. Chart of Accounts Tree Hierarchy & KPI Summaries
 */
router.get("/", chartAccountController.getChartOfAccounts);
router.get("/tree", chartAccountController.getChartOfAccounts);

/**
 * 2. Flat List of Accounts (for dropdowns / selectors)
 */
router.get("/flat", chartAccountController.getFlatAccounts);

/**
 * 3. Parent Account Groups (for Add Account modal)
 */
router.get("/groups", chartAccountController.getAccountGroups);

/**
 * 4. Single Account Details
 */
router.get("/:id", chartAccountController.getAccountDetail);

/**
 * 5. Create Chart of Account
 */
router.post("/", chartAccountController.createAccount);

/**
 * 6. Update Chart of Account
 */
router.put("/:id", chartAccountController.updateAccount);

/**
 * 7. Delete Chart of Account
 */
router.delete("/:id", chartAccountController.deleteAccount);

export default router;
export { router as chartAccountRouter };
