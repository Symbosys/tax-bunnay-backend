import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { authController } from "../controllers/auth.controller";

const authRouter = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new platform user or platform administrator
 * @access  Public
 */
authRouter.post("/register", authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user / platform admin and issue JWT tokens
 * @access  Public
 */
authRouter.post("/login", authController.login);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Issue a new access token using a valid refresh token
 * @access  Public
 */
authRouter.post("/refresh-token", authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Invalidate current user session
 * @access  Public (or semi-protected)
 */
authRouter.post("/logout", authController.logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user profile
 * @access  Protected
 */
authRouter.get("/me", protect, authController.getMe);

export { authRouter };
export default authRouter;
