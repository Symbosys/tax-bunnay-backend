import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";
import { asyncHandler } from "../../../middlewares/error.middleware";
import { SuccessResponse } from "../../../utils/response.util";
import { authService, AuthService } from "../services/auth.service";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "../validators/auth.validators";

export class AuthController {
  private service: AuthService;

  constructor(service: AuthService = authService) {
    this.service = service;
  }

  /**
   * Register a new User / Platform Admin
   * POST /api/v1/auth/register
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    // 1. Validate request body with Zod
    const validatedData = registerSchema.parse(req.body);

    // 2. Extract request metadata
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || req.ip;
    const deviceInfo = (req.headers["user-agent"] as string) || "Unknown Device";

    // 3. Delegate to auth service
    const result = await this.service.register(validatedData, {
      ipAddress,
      deviceInfo,
      platform: req.body.platform || "WEB",
    });

    // 4. Return success response
    return SuccessResponse(
      res,
      result.user.isPlatformAdmin
        ? "Platform Administrator registered successfully"
        : "User account registered successfully",
      result,
      201
    );
  });

  /**
   * Authenticate a User / Platform Admin
   * POST /api/v1/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    // 1. Validate request body with Zod
    const validatedData = loginSchema.parse(req.body);

    // 2. Extract metadata
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress || req.ip;
    const deviceInfo = (req.headers["user-agent"] as string) || "Unknown Device";

    // 3. Delegate to auth service
    const result = await this.service.login(validatedData, {
      ipAddress,
      deviceInfo,
      platform: validatedData.platform,
    });

    // 4. Return success response
    return SuccessResponse(
      res,
      result.user.isPlatformAdmin
        ? "Platform Administrator authenticated successfully"
        : "Login successful",
      result,
      200
    );
  });

  /**
   * Refresh Access Token using Refresh Token
   * POST /api/v1/auth/refresh-token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshTokenSchema.parse(req.body);

    const result = await this.service.refreshToken(refreshToken);

    return SuccessResponse(res, "Access token refreshed successfully", result, 200);
  });

  /**
   * Logout user and invalidate session
   * POST /api/v1/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    const result = await this.service.logout(refreshToken);

    return SuccessResponse(res, "Logged out successfully", result, 200);
  });

  /**
   * Get Current Authenticated User Profile
   * GET /api/v1/auth/me
   */
  getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const profile = await this.service.getCurrentUser(userId);

    return SuccessResponse(res, "User profile retrieved successfully", profile, 200);
  });
}

export const authController = new AuthController();
