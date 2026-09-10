import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { salesInvoiceController } from "../controllers/sales-invoice.controller";

const router = Router();

router.use(protect);

/**
 * Static / Utility endpoints (must be defined BEFORE parameterized `/:id`)
 */
router.get("/next-number", salesInvoiceController.getNextNumber);
router.get("/metrics/summary", salesInvoiceController.getMetrics);
router.get("/held/list", salesInvoiceController.getHeldInvoices);
router.post("/hold", salesInvoiceController.holdInvoice);
router.post("/held/:id/resume", salesInvoiceController.resumeHeldInvoice);

/**
 * Core Sales Invoice CRUD & Actions
 */
router.post("/", salesInvoiceController.createInvoice);
router.get("/", salesInvoiceController.getInvoices);
router.get("/:id", salesInvoiceController.getInvoiceById);
router.get("/:id/receipt", salesInvoiceController.getThermalReceipt);
router.put("/:id", salesInvoiceController.updateInvoice);
router.patch("/:id", salesInvoiceController.updateInvoice);
router.patch("/:id/status", salesInvoiceController.updateStatus);
router.post("/:id/cancel", salesInvoiceController.cancelInvoice);
router.delete("/:id", salesInvoiceController.deleteInvoice);

export default router;
export { router as salesInvoiceRouter };
