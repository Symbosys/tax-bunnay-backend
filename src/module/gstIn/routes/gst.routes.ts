import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { gstController } from "../controllers/gst.controller";

const gstRouter = Router();

// Protect all GST routes with JWT authentication & tenant checks
gstRouter.use(protect);

/**
 * @route   GET /api/v1/gst/profile
 * @desc    Get GST profile details of active business
 * @access  Private
 */
gstRouter.get("/profile", gstController.getProfile);

/**
 * @route   PUT /api/v1/gst/profile
 * @desc    Update GST profile details of active business
 * @access  Private
 */
gstRouter.put("/profile", gstController.updateProfile);

/**
 * @route   GET /api/v1/gst/metrics
 * @desc    Get 5 KPI compliance and liability metrics
 * @access  Private
 */
gstRouter.get("/metrics", gstController.getMetrics);

/**
 * @route   GET /api/v1/gst/returns
 * @desc    Get GST return history and schedule (GSTR-1, GSTR-3B)
 * @access  Private
 */
gstRouter.get("/returns", gstController.getReturns);

/**
 * @route   GET /api/v1/gst/returns/:id
 * @desc    Get single GST return record details
 * @access  Private
 */
gstRouter.get("/returns/:id", gstController.getReturnById);

/**
 * @route   POST /api/v1/gst/returns/file
 * @desc    Submit and file GST return with generated ARN
 * @access  Private
 */
gstRouter.post("/returns/file", gstController.fileReturn);

/**
 * @route   GET /api/v1/gst/liability-summary
 * @desc    Get Tax liability summary donut breakdown (IGST, CGST, SGST, Cess, Paid, Balance)
 * @access  Private
 */
gstRouter.get("/liability-summary", gstController.getLiabilitySummary);

/**
 * @route   GET /api/v1/gst/lookup/:gstin
 * @desc    Search and verify any 15-digit GSTIN
 * @access  Private
 */
gstRouter.get("/lookup/:gstin", gstController.lookupGstin);

/**
 * @route   POST /api/v1/gst/lookup
 * @desc    Search and verify any 15-digit GSTIN via POST body
 * @access  Private
 */
gstRouter.post("/lookup", gstController.lookupGstin);

/**
 * @route   POST /api/v1/gst/sync
 * @desc    Trigger sync with Government GSTN Portal
 * @access  Private
 */
gstRouter.post("/sync", gstController.syncGstPortal);

/**
 * @route   GET /api/v1/gst/export/json/gstr1/:period
 * @desc    Export official GSTR-1 JSON Payload
 * @access  Private
 */
gstRouter.get("/export/json/gstr1/:period", gstController.exportGstr1Json);

/**
 * @route   POST /api/v1/gst/payments
 * @desc    Record GST challan payment
 * @access  Private
 */
gstRouter.post("/payments", gstController.recordPayment);

export { gstRouter };
