import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { posController } from "../controllers/pos.controller";

const router = Router();

// Protect all POS routes with JWT authentication
router.use(protect);

/**
 * POS Product Catalog & Scanner
 */
router.get("/products", posController.getProducts);
router.get("/products/scan/:barcode", posController.scanBarcode);

/**
 * POS Customer Directory & Quick Add
 */
router.get("/customers", posController.getCustomers);
router.post("/customers/quick", posController.quickCreateCustomer);

/**
 * POS Register / Cash Drawer Sessions
 */
router.post("/session/open", posController.openSession);
router.get("/session/active", posController.getActiveSession);
router.post("/session/close", posController.closeSession);
router.get("/session/history", posController.getSessionHistory);

/**
 * POS Checkout & Fast Billing
 */
router.post("/checkout", posController.checkout);
router.post("/sales", posController.checkout);

/**
 * Park / Hold & Resume Transactions
 */
router.post("/cart/hold", posController.holdCart);
router.get("/cart/held", posController.getHeldCarts);
router.post("/cart/resume/:id", posController.resumeCart);
router.delete("/cart/held/:id", posController.deleteHeldCart);

/**
 * Thermal Printer Receipts & Reprints
 */
router.get("/receipt/:invoiceId", posController.getReceipt);

/**
 * Daily Sales Metrics & Terminal Dashboard
 */
router.get("/dashboard/summary", posController.getDashboardSummary);

export default router;
export { router as posRouter };
