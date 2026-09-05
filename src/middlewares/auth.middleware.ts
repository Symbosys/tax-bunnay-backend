import type { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { prisma } from "../db/prisma";
import { verifyToken } from "../utils/jwt.util";
import { ErrorResponse } from "../utils/response.util";
import { asyncHandler } from "./error.middleware";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Protect middleware: Verifies JWT access token and attaches user to request
 */
export const protect = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // 1. Extract token from cookies
    if (req.cookies && typeof req.cookies.token === "string") {
      token = req.cookies.token;
    } else if (req.headers.cookie) {
      const rawCookies = req.headers.cookie.split(";");
      for (const rawCookie of rawCookies) {
        const parts = rawCookie.split("=");
        const key = parts[0];
        const val = parts[1];
        if (key && val && key.trim() === "token") {
          token = val.trim();
          break;
        }
      }
    }

    // 2. Fallback to Bearer Authorization header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      return next(new ErrorResponse("Not authorized to access this route", 401));
    }

    try {
      const jwtSecret = env.jwt.secret || "123456";
      const decoded = verifyToken(token, jwtSecret);

      if (!decoded || !decoded.id) {
        return next(new ErrorResponse("Invalid token payload", 401));
      }

      // Fetch user from DB
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          businessMemberships: {
            include: {
              business: true,
            },
          },
          ownedBusinesses: true,
        },
      });

      if (!user) {
        return next(new ErrorResponse("User account not found", 404));
      }

      if (!user.isActive) {
        return next(
          new ErrorResponse(
            "Account has been deactivated. Please contact support.",
            403
          )
        );
      }

      // Sanitize user before attaching to request
      const { passwordHash, twoFactorSecret, ...sanitizedUser } = user;
      req.user = sanitizedUser;

      next();
    } catch (error: any) {
      return next(
        new ErrorResponse("Not authorized to access this route", 401)
      );
    }
  }
);

/**
 * Route authorization restriction middleware based on Platform Admin status
 */
export const requirePlatformAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }

  if (!req.user.isPlatformAdmin) {
    return next(
      new ErrorResponse(
        "Forbidden: Platform Administrator privileges required",
        403
      )
    );
  }

  next();
};

/**
 * Route authorization restriction middleware based on business roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ErrorResponse("Not authorized to access this route", 401));
    }

    // Platform admins always bypass tenant restrictions
    if (req.user.isPlatformAdmin) {
      return next();
    }

    const activeBusinessId = (req.headers["x-business-id"] as string) || req.query.businessId;

    if (activeBusinessId) {
      const membership = req.user.businessMemberships?.find(
        (m: any) => m.businessId === activeBusinessId
      );

      if (!membership || !roles.includes(membership.role)) {
        return next(
          new ErrorResponse("You do not have permission to perform this action", 403)
        );
      }
    }

    next();
  };
};
