export interface WarehouseLocation {
  id: string;
  name: string;
  code: string;
  address: string;
  contact: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseProductStock {
  productId: string;
  name: string;
  itemCode: string;
  sku: string;
  primaryUnit: string;
  warehouseId: string | null;
  warehouseName: string | null;
  openingStock: number;
  currentStock: number;
  warehouseStocks: Record<string, number>;
  purchasePrice: number;
  isActive: boolean;
}

export interface StockTransferItemView {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
}

export interface StockTransferLog {
  id: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  transferDate: Date;
  notes: string;
  referenceNumber: string;
  status: "CONFIRMED";
  items: StockTransferItemView[];
  createdAt: Date;
}
