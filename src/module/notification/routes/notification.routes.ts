import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { notificationController } from "../controllers/notification.controller";

const router = Router();

/**
 * Register FCM device token
 * Supports both protected (with user context) and public onboarding registration
 */
router.post("/token", notificationController.registerToken);
router.post("/register-token", notificationController.registerToken);

/**
 * Protected routes requiring user & business context
 */
router.get("/tokens", protect, notificationController.getTokens);
router.delete("/token", protect, notificationController.deactivateToken);

router.get("/", protect, notificationController.getNotifications);
router.get("/unread-count", protect, notificationController.getUnreadCount);
router.patch("/mark-all-read", protect, notificationController.markAllAsRead);
router.patch("/:id/read", protect, notificationController.markAsRead);

router.post("/test-send", protect, notificationController.sendTestNotification);

export const notificationRouter = router;
export default router;
