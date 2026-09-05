import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { serviceController } from "../controllers/service.controller";

const serviceRouter = Router();

// Protect all service routes with JWT authentication & tenant checks
serviceRouter.use(protect);

/**
 * @route   GET /api/v1/services/metrics/summary
 * @desc    Get high-level service metrics for directory dashboard
 * @access  Private
 */
serviceRouter.get("/metrics/summary", serviceController.getServiceMetrics);

/**
 * @route   GET /api/v1/services
 * @desc    List, search, filter, and paginate services
 * @access  Private
 */
serviceRouter.get("/", serviceController.getServices);

/**
 * @route   POST /api/v1/services
 * @desc    Create a new service under current business
 * @access  Private
 */
serviceRouter.post("/", serviceController.createService);

/**
 * @route   GET /api/v1/services/:id
 * @desc    Get detailed service profile
 * @access  Private
 */
serviceRouter.get("/:id", serviceController.getServiceById);

/**
 * @route   PUT /api/v1/services/:id
 * @desc    Update complete service record
 * @access  Private
 */
serviceRouter.put("/:id", serviceController.updateService);

/**
 * @route   PATCH /api/v1/services/:id
 * @desc    Partially update service record
 * @access  Private
 */
serviceRouter.patch("/:id", serviceController.updateService);

/**
 * @route   DELETE /api/v1/services/:id
 * @desc    Delete service or soft-delete if linked invoices exist
 * @access  Private
 */
serviceRouter.delete("/:id", serviceController.deleteService);

export { serviceRouter };
