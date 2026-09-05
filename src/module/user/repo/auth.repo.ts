import { prisma } from "../../../db/prisma";

export class AuthRepository {
  /**
   * Find a user by their unique email address
   */
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        businessMemberships: {
          include: {
            business: {
              select: {
                id: true,
                businessName: true,
                tradeName: true,
                gstin: true,
                isActive: true,
              },
            },
          },
        },
        ownedBusinesses: {
          select: {
            id: true,
            businessName: true,
            tradeName: true,
            gstin: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Find a user by their unique ID
   */
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        businessMemberships: {
          include: {
            business: {
              select: {
                id: true,
                businessName: true,
                tradeName: true,
                gstin: true,
                isActive: true,
              },
            },
          },
        },
        ownedBusinesses: {
          select: {
            id: true,
            businessName: true,
            tradeName: true,
            gstin: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Create a new user record in the database
   */
  async createUser(data: {
    fullName: string;
    email: string;
    passwordHash: string;
    phone?: string | null;
    isPlatformAdmin?: boolean;
    isEmailVerified?: boolean;
  }) {
    return prisma.user.create({
      data: {
        fullName: data.fullName.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        phone: data.phone?.trim() || null,
        isPlatformAdmin: data.isPlatformAdmin ?? false,
        isEmailVerified: data.isEmailVerified ?? false,
      },
      include: {
        businessMemberships: true,
        ownedBusinesses: true,
      },
    });
  }

  /**
   * Update user details by ID
   */
  async updateUser(id: string, data: Partial<{
    fullName: string;
    phone: string | null;
    passwordHash: string;
    isEmailVerified: boolean;
    isActive: boolean;
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    lastLoginAt: Date;
  }>) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Update last login timestamp for user
   */
  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Create a new session with refresh token
   */
  async createSession(data: {
    userId: string;
    refreshToken: string;
    deviceInfo?: string | null;
    ipAddress?: string | null;
    platform?: string | null;
    expiresAt: Date;
  }) {
    return prisma.session.create({
      data: {
        userId: data.userId,
        refreshToken: data.refreshToken,
        deviceInfo: data.deviceInfo || null,
        ipAddress: data.ipAddress || null,
        platform: data.platform || "WEB",
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Find active session by refresh token
   */
  async findSessionByToken(refreshToken: string) {
    return prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: true,
      },
    });
  }

  /**
   * Revoke a single session
   */
  async revokeSession(refreshToken: string) {
    return prisma.session.updateMany({
      where: {
        refreshToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Count total platform admins
   */
  async countPlatformAdmins(): Promise<number> {
    return prisma.user.count({
      where: { isPlatformAdmin: true },
    });
  }

  /**
   * Count total users
   */
  async countUsers(): Promise<number> {
    return prisma.user.count();
  }
}

export const authRepo = new AuthRepository();
