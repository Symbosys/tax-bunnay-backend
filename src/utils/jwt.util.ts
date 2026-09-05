import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Generates a cryptographically secure 4-digit OTP
 */
export const generateOTP = (): string => {
  return crypto.randomInt(1000, 10000).toString();
};

/**
 * Signs a payload and returns a JWT token
 * @param payload The data to store in the token
 * @param secret The secret key used to sign the token
 * @param expiresInSeconds The token expiration time in seconds (default: 30 days)
 */
export const signToken = (payload: any, secret: string, expiresInSeconds: number = 86400 * 30): string => {
  const jwtSign = jwt.sign || (jwt as any).default?.sign;
  return jwtSign(payload, secret, {
    expiresIn: expiresInSeconds,
  });
};

/**
 * Verifies a JWT token and returns the decoded payload
 * @param token The token to verify
 * @param secret The secret key used to sign the token
 */
export const verifyToken = (token: string, secret: string): any => {
  const jwtVerify = jwt.verify || (jwt as any).default?.verify;
  return jwtVerify(token, secret);
};
