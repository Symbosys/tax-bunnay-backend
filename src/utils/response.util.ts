import type { Response } from "express";

export class ErrorResponse extends Error {
    constructor(public override message: string, public statusCode: number) {
      super(message);
      this.statusCode = statusCode;

      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export const SuccessResponse = (
    res: Response,
    message: string,
    data: any = {},
    statusCode: number = 200
  ) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data: normalizeBigInt(data),
    });
  };


 export function normalizeBigInt(obj: any): any {
    if (obj instanceof Date) {
      return isNaN(obj.getTime()) ? null : obj.toISOString(); // ✅ serialize Date properly safely
    } else if (typeof obj === "bigint") {
      return obj.toString(); // ✅ BigInt -> string
    } else if (obj && typeof obj === "object" && typeof obj.toNumber === "function") {
      return obj.toNumber(); // ✅ Prisma Decimal -> number
    } else if (
      obj &&
      typeof obj === "object" &&
      "d" in obj &&
      "s" in obj &&
      "e" in obj &&
      Array.isArray(obj.d)
    ) {
      // ✅ Serialized Decimal object { d: [400], s: 1, e: 2 } fallback
      const sign = obj.s < 0 ? -1 : 1;
      const digits = obj.d.join("");
      const power = (obj.e ?? 0) - digits.length + 1;
      const num = Number(digits) * Math.pow(10, power);
      return isNaN(num) ? 0 : sign * num;
    } else if (Array.isArray(obj)) {
      return obj.map(normalizeBigInt);
    } else if (obj && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, normalizeBigInt(v)])
      );
    }
    return obj;
  }
  
  