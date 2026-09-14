import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { generalLedgerController } from "../controllers/general-ledger.controller";

const router = Router();

// Protect all general ledger routes with JWT authentication
router.use(protect);

/**
 * 1. General Ledger Data & Summaries
 */
router.get("/", generalLedgerController.getGeneralLedger);
router.get("/summary", generalLedgerController.getGeneralLedger);

/**
 * 2. Chart of Accounts Dropdown
 */
router.get("/accounts", generalLedgerController.getAccounts);

/**
 * 3. Export Operations
 */
router.get("/export", generalLedgerController.exportLedger);
router.post("/export", generalLedgerController.exportLedger);

/**
 * 4. Create Double-Entry Journal Voucher
 */
router.post("/voucher", generalLedgerController.createVoucher);

/**
 * 5. Single Voucher Detail (with Double-Entry Legs)
 */
router.get("/:id", generalLedgerController.getVoucherDetail);

export default router;
export { router as generalLedgerRouter };
