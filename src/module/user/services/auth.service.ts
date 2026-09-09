import bcrypt from "bcrypt";
import env from "../../../config/env.config";
import { signToken, verifyToken } from "../../../utils/jwt.util";
import { ErrorResponse } from "../../../utils/response.util";
import { authRepo, AuthRepository } from "../repo/auth.repo";
import type { LoginInput, RegisterInput } from "../validators/auth.validators";

export class AuthService {
  private repo: AuthRepository;

  constructor(repo: AuthRepository = authRepo) {
    this.repo = repo;
  }

  /**
   * Helper to strip sensitive fields before returning user object
   */
  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Register a new User or Platform Admin
   */
  async register(
    input: RegisterInput,
    meta?: { ipAddress?: string; platform?: string; deviceInfo?: string }
  ) {
    const email = input.email.toLowerCase().trim();

    // 1. Check if user with this email already exists
    const existingUser = await this.repo.findUserByEmail(email);
    if (existingUser) {
      throw new ErrorResponse(
        "An account with this email address already exists. Please sign in instead.",
        409
      );
    }

    // 2. Hash password securely
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // 3. Create user in database
    const user = await this.repo.createUser({
      fullName: input.fullName.trim(),
      email,
      passwordHash,
      phone: input.phone || null,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
      isEmailVerified: true, // Default verified for smooth platform onboarding
    });

    // 4. Generate JWT tokens
    const jwtSecret = env.jwt.secret || "123456";
    const tokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: user.isPlatformAdmin,
      role: user.isPlatformAdmin ? "PLATFORM_ADMIN" : "USER",
    };

    // Access token valid for 7 days, Refresh token valid for 30 days
    const accessToken = signToken(tokenPayload, jwtSecret, 7 * 24 * 60 * 60);
    const refreshToken = signToken(
      { id: user.id, type: "refresh" },
      jwtSecret,
      30 * 24 * 60 * 60
    );

    // 5. Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.repo.createSession({
      userId: user.id,
      refreshToken,
      deviceInfo: meta?.deviceInfo || null,
      ipAddress: meta?.ipAddress || null,
      platform: meta?.platform || "WEB",
      expiresAt,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticate a User or Platform Admin
   */
  async login(
    input: LoginInput,
    meta?: { ipAddress?: string; platform?: string; deviceInfo?: string }
  ) {
    const email = input.email.toLowerCase().trim();

    // 1. Find user by email
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new ErrorResponse(
        "Invalid email or password. Please check your credentials and try again.",
        401
      );
    }

    // 2. Check if account is active
    if (!user.isActive) {
      throw new ErrorResponse(
        "Your account has been deactivated. Please contact the platform administrator.",
        403
      );
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new ErrorResponse(
        "Invalid email or password. Please check your credentials and try again.",
        401
      );
    }

    // 4. Strict Portal Segregation:
    // Platform Admin portal ONLY allows platform administrators
    if (input.isPlatformAdminPortal && !user.isPlatformAdmin) {
      throw new ErrorResponse(
        "Access Denied: This account does not possess Platform Administrator permissions.",
        403
      );
    }

    // Organization portal ONLY allows organization accounts (Platform Admin accounts MUST use Platform Admin Panel)
    if (!input.isPlatformAdminPortal && user.isPlatformAdmin) {
      throw new ErrorResponse(
        "Access Denied: Platform Administrator accounts cannot log in to the Organization portal. Please use the Platform Admin Panel.",
        403
      );
    }

    // 5. Update last login timestamp
    await this.repo.updateLastLogin(user.id);

    // 6. Generate JWT Tokens
    const jwtSecret = env.jwt.secret || "123456";
    const tokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: user.isPlatformAdmin,
      role: user.isPlatformAdmin ? "PLATFORM_ADMIN" : "USER",
    };

    const accessToken = signToken(tokenPayload, jwtSecret, 7 * 24 * 60 * 60);
    const refreshToken = signToken(
      { id: user.id, type: "refresh" },
      jwtSecret,
      30 * 24 * 60 * 60
    );

    // 7. Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.repo.createSession({
      userId: user.id,
      refreshToken,
      deviceInfo: meta?.deviceInfo || null,
      ipAddress: meta?.ipAddress || null,
      platform: meta?.platform || input.platform || "WEB",
      expiresAt,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh expired access token using a valid refresh token
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new ErrorResponse("Refresh token is required.", 400);
    }

    const jwtSecret = env.jwt.secret || "123456";

    // 1. Verify token signature
    let decoded: any;
    try {
      decoded = verifyToken(refreshToken, jwtSecret);
    } catch {
      throw new ErrorResponse("Invalid or expired session token. Please sign in again.", 401);
    }

    // 2. Lookup session in database
    const session = await this.repo.findSessionByToken(refreshToken);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new ErrorResponse("Session has expired or was revoked. Please sign in again.", 401);
    }

    // 3. Check user status
    const user = session.user;
    if (!user || !user.isActive) {
      throw new ErrorResponse("User account is inactive.", 403);
    }

    // 4. Generate new access token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: user.isPlatformAdmin,
      role: user.isPlatformAdmin ? "PLATFORM_ADMIN" : "USER",
    };

    const accessToken = signToken(tokenPayload, jwtSecret, 7 * 24 * 60 * 60);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Log out user and revoke session
   */
  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.repo.revokeSession(refreshToken);
    }
    return { success: true, message: "Logged out successfully" };
  }

  /**
   * Get current authenticated user profile
   */
  async getCurrentUser(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new ErrorResponse("User profile not found.", 404);
    }
    return this.sanitizeUser(user);
  }
}

export const authService = new AuthService();
