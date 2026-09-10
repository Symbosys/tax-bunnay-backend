export interface SalesReturnSummaryMetrics {
  totalReturnValue: number;
  confirmedCount: number;
  draftCount: number;
  cancelledCount: number;
  itemsRestocked: number;
}

export interface ThermalCreditNoteReceipt {
  storeName: string;
  storeAddress: string;
  storeGstin: string;
  storePhone: string;
  creditNoteNumber: string;
  originalInvoiceNumber: string;
  returnDate: string;
  customerName: string;
  customerPhone: string;
  cashier: string;
  reason: string;
  refundMode: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    rate: number;
    gstRate: number;
    amount: number;
    reason?: string;
  }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  grandTotal: number;
  amountInWords?: string;
}
