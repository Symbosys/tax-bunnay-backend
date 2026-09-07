import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { env } from "./config/env.config";
import { errorMiddleware } from "./middlewares/error.middleware";
import { ErrorResponse } from "./utils/response.util";

import { authRouter } from "./module/user/routes/auth.routes";
import { onboardingRouter } from "./module/onboarding/routes/onboarding.routes";
import { customerRouter } from "./module/business/customer/routes/customer.routes";
import { supplierRouter } from "./module/business/suppliers/routes/supplier.routes";
import { serviceRouter } from "./module/business/services&work/routes/service.routes";
import { productRouter } from "./module/business/productListing/routes/product.routes";
import { gstRouter } from "./module/gstIn/routes/gst.routes";
import { platformOrganizationRouter } from "./module/platform-Admin/organization/routes/organization.routes";
import { platformPlanRouter } from "./module/platform-Admin/plans/routes/plan.routes";
import { posRouter } from "./module/pos";
import { receiptRouter } from "./module/payment&receipts/receipt/routes/receipt.routes";
import { paymentEntryRouter } from "./module/payment&receipts/payment-entry/routes/payment-entry.routes";
import { outstandingRouter } from "./module/payment&receipts/outstanding-analysis/routes/outstanding.routes";

const app = express();

/**
 * CORS
 */
app.use(
  cors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Business-ID",
      "x-business-id",
    ],
  })
);

/**
 * Body Parser
 */
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/**
 * Request Logger
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(
    `[API HIT] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
  );
  next();
});

/**
 * Health Check
 */
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Billing ERP Software server running",
    nodeEnv: env.server.nodeEnv,
  });
});

/**
 * API Routes
 */
app.use("/api/v1/auth", authRouter);
app.use("/api/auth", authRouter);
app.use("/api/v1/onboarding", onboardingRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/v1/customers", customerRouter);
app.use("/api/customers", customerRouter);
app.use("/api/v1/business/customers", customerRouter);
app.use("/api/business/customers", customerRouter);
app.use("/api/v1/suppliers", supplierRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/v1/business/suppliers", supplierRouter);
app.use("/api/business/suppliers", supplierRouter);
app.use("/api/v1/services", serviceRouter);
app.use("/api/services", serviceRouter);
app.use("/api/v1/business/services", serviceRouter);
app.use("/api/business/services", serviceRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/products", productRouter);
app.use("/api/v1/business/products", productRouter);
app.use("/api/business/products", productRouter);
app.use("/api/v1/gst", gstRouter);
app.use("/api/gst", gstRouter);
app.use("/api/v1/business/gst", gstRouter);
app.use("/api/business/gst", gstRouter);
app.use("/api/v1/platform-admin/organizations", platformOrganizationRouter);
app.use("/api/platform-admin/organizations", platformOrganizationRouter);
app.use("/api/v1/platform-admin/plans", platformPlanRouter);
app.use("/api/platform-admin/plans", platformPlanRouter);
app.use("/api/v1/pos", posRouter);
app.use("/api/pos", posRouter);
app.use("/api/v1/receipts", receiptRouter);
app.use("/api/receipts", receiptRouter);
app.use("/api/v1/payments", paymentEntryRouter);
app.use("/api/payments", paymentEntryRouter);
app.use("/api/v1/outstanding", outstandingRouter);
app.use("/api/outstanding", outstandingRouter);



/**
 * 404 Handler
 * Catches all requests that don't match any route
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new ErrorResponse(`Route ${req.originalUrl} not found`, 404));
});

/**
 * Error Middleware
 * Must be after all routes.
 */
app.use(errorMiddleware);

/**
 * Start Server
 */
const PORT = env.server.port;

app.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://localhost:${PORT} (0.0.0.0:${PORT})`);

  // Automatically reverse port to connected Android devices in dev mode
  if (process.env.NODE_ENV !== "production") {
    try {
      const { exec } = await import("child_process");
      exec(`adb reverse tcp:${PORT} tcp:${PORT}`, (err) => {
        if (!err) {
          console.log(`📱 [ADB] Reversed tcp:${PORT} to connected Android device`);
        }
      });
    } catch (_) {}
  }
});

/**
 * Global Process Error Listeners
 * Handles unexpected process level failures gracefully
 */
process.on("unhandledRejection", (reason: any) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[FATAL] Uncaught Exception:", error);
});