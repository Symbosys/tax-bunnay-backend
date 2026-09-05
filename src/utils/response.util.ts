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
    } else if (Array.isArray(obj)) {
      return obj.map(normalizeBigInt);
    } else if (obj && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, normalizeBigInt(v)])
      );
    }
    return obj;
  }
  
  