import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { supplierController } from "../controllers/supplier.controller";

const supplierRouter = Router();

// Protect all supplier routes with JWT authentication & tenant checks
supplierRouter.use(protect);

/**
 * @route   GET /api/v1/suppliers/metrics/summary
 * @desc    Get high-level supplier metrics for directory dashboard
 * @access  Private
 */
supplierRouter.get("/metrics/summary", supplierController.getSupplierMetrics);

/**
 * @route   GET /api/v1/suppliers
 * @desc    List, search, filter, and paginate suppliers
 * @access  Private
 */
supplierRouter.get("/", supplierController.getSuppliers);

/**
 * @route   POST /api/v1/suppliers
 * @desc    Create a new supplier under current business
 * @access  Private
 */
supplierRouter.post("/", supplierController.createSupplier);

/**
 * @route   GET /api/v1/suppliers/:id
 * @desc    Get detailed supplier profile with recent transaction history
 * @access  Private
 */
supplierRouter.get("/:id", supplierController.getSupplierById);

/**
 * @route   PUT /api/v1/suppliers/:id
 * @desc    Update complete supplier record
 * @access  Private
 */
supplierRouter.put("/:id", supplierController.updateSupplier);

/**
 * @route   PATCH /api/v1/suppliers/:id
 * @desc    Partially update supplier record
 * @access  Private
 */
supplierRouter.patch("/:id", supplierController.updateSupplier);

/**
 * @route   DELETE /api/v1/suppliers/:id
 * @desc    Delete supplier or soft-delete if linked transactions exist
 * @access  Private
 */
supplierRouter.delete("/:id", supplierController.deleteSupplier);

export { supplierRouter };
