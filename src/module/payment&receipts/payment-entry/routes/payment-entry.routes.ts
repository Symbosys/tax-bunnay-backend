import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { paymentEntryController } from "../controllers/payment-entry.controller";

const paymentEntryRouter = Router();

// Protect all payment endpoints with JWT authentication & tenant checks
paymentEntryRouter.use(protect);

/**
 * @route   GET /api/v1/payments/metrics/summary
 * @desc    Get payment KPI summary metrics
 * @access  Private
 */
paymentEntryRouter.get("/metrics/summary", paymentEntryController.getMetrics);

/**
 * @route   GET /api/v1/payments/next-ref
 * @desc    Get auto-generated next payment reference code / transaction ID
 * @access  Private
 */
paymentEntryRouter.get("/next-ref", paymentEntryController.getNextReferenceNumber);

/**
 * @route   GET /api/v1/payments/supplier/:supplierId/unpaid-purchases
 * @desc    Get unpaid purchases for supplier bill allocation dropdown
 * @access  Private
 */
paymentEntryRouter.get(
  "/supplier/:supplierId/unpaid-purchases",
  paymentEntryController.getUnpaidPurchasesBySupplier
);

/**
 * @route   GET /api/v1/payments
 * @desc    List and filter supplier payments
 * @access  Private
 */
paymentEntryRouter.get("/", paymentEntryController.getPayments);

/**
 * @route   POST /api/v1/payments
 * @desc    Record a new supplier payment
 * @access  Private
 */
paymentEntryRouter.post("/", paymentEntryController.createPayment);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment details by ID
 * @access  Private
 */
paymentEntryRouter.get("/:id", paymentEntryController.getPaymentById);

/**
 * @route   DELETE /api/v1/payments/:id
 * @desc    Delete a payment and restore bill balance
 * @access  Private
 */
paymentEntryRouter.delete("/:id", paymentEntryController.deletePayment);

export { paymentEntryRouter };
