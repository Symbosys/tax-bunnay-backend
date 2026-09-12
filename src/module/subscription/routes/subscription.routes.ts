import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { subscriptionController } from "../controllers/subscription.controller";

const router = Router();

/**
 * Public / Authenticated route to view available SaaS plans
 */
router.get("/plans", subscriptionController.getPlans);

/**
 * Protected routes requiring an active user session & business context
 */
router.get("/active", protect, subscriptionController.getActiveSubscription);
router.post("/subscribe", protect, subscriptionController.subscribe);
router.post("/purchase", protect, subscriptionController.subscribe);

export const subscriptionRouter = router;
export default router;
