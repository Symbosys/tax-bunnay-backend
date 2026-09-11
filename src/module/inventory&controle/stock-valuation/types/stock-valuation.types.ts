export interface StockValuationSummary {
  totalStockValuation: number;
  totalUnits: number;
  uniqueProductCount: number;
  inStockCount: number;
  lowStockCount: number;
  zeroStockCount: number;
  valuationMethod: "PURCHASE_PRICE";
}

export interface StockValuationItem {
  productId: string;
  name: string;
  itemCode: string;
  sku: string;
  barcode: string;
  primaryUnit: string;
  category: string;
  warehouseId: string | null;
  warehouseName: string | null;
  purchasePrice: number;
  sellingPrice: number;
  openingStock: number;
  currentStock: number;
  minStockLevel: number;
  stockValue: number;
  isLowStock: boolean;
  isActive: boolean;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  productName: string;
  itemCode: string;
  warehouseId: string;
  warehouseName: string;
  movementType: string;
  quantity: number;
  unitCost: number | null;
  stockValueImpact: number;
  batchNumber: string | null;
  serialNumber: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string;
  movementDate: Date;
  createdAt: Date;
}
