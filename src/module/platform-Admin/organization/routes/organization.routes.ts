import { Router } from "express";
import {
  protect,
  requirePlatformAdmin,
} from "../../../../middlewares/auth.middleware";
import { platformOrganizationController } from "../controllers/organization.controller";

const router = Router();

/**
 * All routes in Platform Admin Organization directory require:
 * 1. An active authenticated session (JWT token)
 * 2. Platform Administrator privileges (isPlatformAdmin: true)
 */
router.use(protect);
router.use(requirePlatformAdmin);

/**
 * Platform Organization KPIs summary
 * Note: Must be placed above /:id route to avoid parameter capture
 */
router.get("/kpis", platformOrganizationController.getKPIs);

/**
 * Organization Directory Listing & Creation
 */
router
  .route("/")
  .get(platformOrganizationController.listOrganizations)
  .post(platformOrganizationController.createOrganization);

/**
 * Single Organization Tenant operations
 */
router
  .route("/:id")
  .get(platformOrganizationController.getOrganizationDetails)
  .put(platformOrganizationController.updateOrganization)
  .delete(platformOrganizationController.deleteOrganization);

/**
 * Quick status toggle (Active, Suspended, Trial)
 */
router.patch("/:id/status", platformOrganizationController.toggleStatus);

/**
 * Impersonate organization owner login
 */
router.post(
  "/:id/impersonate",
  platformOrganizationController.impersonateTenant
);

export const platformOrganizationRouter = router;
export default router;
