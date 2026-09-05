import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.config";
import { statusCode } from "../types/types";
import { zodError } from "../utils/utils";

export const errorMiddleware = (
  err: any, 
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (env.server.nodeEnv === "development") {
    console.error("[Error Middleware] Caught error:", err);
  }

  let statusCodeValue = err?.statusCode || 500;
  let messageValue = err?.message || "Internal Server Error";

  if (err?.name === "CastError") {
    messageValue = "Invalid ID";
    statusCodeValue = statusCode.Bad_Request;
  }
  
  if (err?.code === "P2025") {
    messageValue = "Item not found";
    statusCodeValue = statusCode.Not_Found;
  }
  
  if (err?.code === "P2003") {
    statusCodeValue = statusCode.Bad_Request;
    messageValue = "Foreign key constraint error: associated employee record not found";
  }
  
  if (err?.code === "P2002") {
    const target = err.meta?.target;
    statusCodeValue = statusCode.Conflict;
    messageValue = target && (Array.isArray(target) ? target.length > 0 : true)
      ? `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists` 
      : "Conflict: Record with unique constraint already exists";
  }

  // ✅ Handle Zod error
  if (err instanceof ZodError) {
    const errors = zodError(err);
    const firstErrorMessage =
      err.issues.length > 0 ? err.issues[0]?.message : "Validation Error";

    return res.status(statusCode.Bad_Request).json({
      success: false,
      message: firstErrorMessage || "Validation Error",
      errors,
    });
  }

  // Final Error Response
  return res.status(statusCodeValue).json({
    success: false,
    message: messageValue,
    ...(env.server.nodeEnv === "development" && {
      stack: err?.stack,
      errorDetails: err,
    }),
  });
};

export default errorMiddleware;


type AsyncHandlerFunction<TReq extends Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler =
  <TReq extends Request>(fn: AsyncHandlerFunction<TReq>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };



