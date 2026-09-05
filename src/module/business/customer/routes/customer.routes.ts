import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { customerController } from "../controllers/customer.controller";

const customerRouter = Router();

// Protect all customer routes with JWT authentication & tenant checks
customerRouter.use(protect);

/**
 * @route   GET /api/v1/customers/metrics/summary
 * @desc    Get high-level customer metrics for directory dashboard
 * @access  Private
 */
customerRouter.get("/metrics/summary", customerController.getCustomerMetrics);

/**
 * @route   GET /api/v1/customers
 * @desc    List, search, filter, and paginate customers
 * @access  Private
 */
customerRouter.get("/", customerController.getCustomers);

/**
 * @route   POST /api/v1/customers
 * @desc    Create a new customer under current business
 * @access  Private
 */
customerRouter.post("/", customerController.createCustomer);

/**
 * @route   GET /api/v1/customers/:id
 * @desc    Get detailed customer profile with recent transaction history
 * @access  Private
 */
customerRouter.get("/:id", customerController.getCustomerById);

/**
 * @route   PUT /api/v1/customers/:id
 * @desc    Update complete customer record
 * @access  Private
 */
customerRouter.put("/:id", customerController.updateCustomer);

/**
 * @route   PATCH /api/v1/customers/:id
 * @desc    Partially update customer record
 * @access  Private
 */
customerRouter.patch("/:id", customerController.updateCustomer);

/**
 * @route   DELETE /api/v1/customers/:id
 * @desc    Delete customer or soft-delete if linked transactions exist
 * @access  Private
 */
customerRouter.delete("/:id", customerController.deleteCustomer);

export { customerRouter };
