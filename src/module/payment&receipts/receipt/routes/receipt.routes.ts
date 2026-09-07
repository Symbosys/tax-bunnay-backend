import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { receiptController } from "../controllers/receipt.controller";

const receiptRouter = Router();

// Protect all receipt endpoints with JWT authentication & tenant checks
receiptRouter.use(protect);

/**
 * @route   GET /api/v1/receipts/metrics/summary
 * @desc    Get receipt KPI metrics summary
 * @access  Private
 */
receiptRouter.get("/metrics/summary", receiptController.getMetrics);

/**
 * @route   GET /api/v1/receipts/next-ref
 * @desc    Get auto-generated next receipt reference number
 * @access  Private
 */
receiptRouter.get("/next-ref", receiptController.getNextReferenceNumber);

/**
 * @route   GET /api/v1/receipts/customer/:customerId/unpaid-invoices
 * @desc    Get unpaid invoices for customer receipt allocation dropdown
 * @access  Private
 */
receiptRouter.get(
  "/customer/:customerId/unpaid-invoices",
  receiptController.getUnpaidInvoicesByCustomer
);

/**
 * @route   GET /api/v1/receipts
 * @desc    List and filter customer receipts
 * @access  Private
 */
receiptRouter.get("/", receiptController.getReceipts);

/**
 * @route   POST /api/v1/receipts
 * @desc    Record a new customer receipt
 * @access  Private
 */
receiptRouter.post("/", receiptController.createReceipt);

/**
 * @route   GET /api/v1/receipts/:id
 * @desc    Get receipt details by ID
 * @access  Private
 */
receiptRouter.get("/:id", receiptController.getReceiptById);

/**
 * @route   DELETE /api/v1/receipts/:id
 * @desc    Delete a receipt and revert invoice balances
 * @access  Private
 */
receiptRouter.delete("/:id", receiptController.deleteReceipt);

export { receiptRouter };
