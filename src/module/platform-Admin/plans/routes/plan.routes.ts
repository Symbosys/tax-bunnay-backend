import { Router } from "express";
import {
  protect,
  requirePlatformAdmin,
} from "../../../../middlewares/auth.middleware";
import { platformPlanController } from "../controllers/plan.controller";

const router = Router();

/**
 * All routes in Platform Admin Plans management require:
 * 1. An active authenticated session (JWT token)
 * 2. Platform Administrator privileges (isPlatformAdmin: true)
 */
router.use(protect);
router.use(requirePlatformAdmin);

/**
 * Plan Listing & Creation
 */
router
  .route("/")
  .get(platformPlanController.getPlans)
  .post(platformPlanController.createPlan);

/**
 * Single Plan Update & Deletion
 */
router
  .route("/:id")
  .put(platformPlanController.updatePlan)
  .delete(platformPlanController.deletePlan);

export const platformPlanRouter = router;
export default router;
