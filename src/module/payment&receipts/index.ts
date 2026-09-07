// ============================================================
// payment&receipts/index.ts
// Barrel export for Payment & Receipts module components:
// 1. receipt (Customer Receipts & Multi-Invoice Allocations)
// 2. payment-entry (Supplier Payments & Purchase Allocations)
// 3. outstanding-analysis (Ageing, Receivables, Payables)
// ============================================================

// Receipt sub-module exports
export * from "./receipt/controllers/receipt.controller";
export * from "./receipt/services/receipt.service";
export * from "./receipt/repo/receipt.repo";
export * from "./receipt/routes/receipt.routes";
export * from "./receipt/validators/receipt.validators";

// Payment Entry sub-module exports
export * from "./payment-entry/controllers/payment-entry.controller";
export * from "./payment-entry/services/payment-entry.service";
export * from "./payment-entry/repo/payment-entry.repo";
export * from "./payment-entry/routes/payment-entry.routes";
export * from "./payment-entry/validators/payment-entry.validators";

// Outstanding Analysis sub-module exports
export * from "./outstanding-analysis/controllers/outstanding.controller";
export * from "./outstanding-analysis/services/outstanding.service";
export * from "./outstanding-analysis/repo/outstanding.repo";
export * from "./outstanding-analysis/routes/outstanding.routes";
export * from "./outstanding-analysis/validators/outstanding.validators";
