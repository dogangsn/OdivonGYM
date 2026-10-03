import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

/** `GET /gym/stock/low`: minimum stokun altındaki ürün ve önerilen sipariş miktarı. */
export interface LowStockItem {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  suggestedQty: number;
  unitCost: number;
  supplierId: string | null;
  supplierName: string | null;
}

export interface StockCountLine {
  productId: string;
  productName: string;
  sku: string;
  expected: number;
  counted: number | null;
  difference: number | null;
}

export interface StockCountSummary {
  totalLines: number;
  countedLines: number;
  shortageUnits: number;
  surplusUnits: number;
  mismatchedLines: number;
}

export interface StockCount {
  id: string;
  status: 'open' | 'completed' | 'cancelled';
  notes: string;
  lines?: StockCountLine[];
  summary: StockCountSummary;
  createdAt: string;
  completedAt: string | null;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplierName: string;
  lines: PurchaseOrderLine[];
  totalAmount: number;
  expectedDate: string | null;
  notes: string;
  orderedAt: string | null;
  receivedAt: string | null;
  receivedAmount: number | null;
  createdAt: string;
}

export interface PurchaseOrderInput {
  supplierId?: string;
  lines?: { productId: string; quantity: number; unitCost: number }[];
  expectedDate?: string;
  notes?: string;
}

/** Stok sayımı, minimum stok ve tedarikçi siparişleri (`/gym/stock/*`). */
@Injectable({ providedIn: 'root' })
export class StockApi {
  private readonly api = inject(ApiClient);

  lowStock(supplierId?: string) {
    return this.api.get<LowStockItem[]>('/gym/stock/low', { supplierId }).pipe(map((r) => unwrapList<LowStockItem>(r.data)));
  }

  counts() {
    return this.api.get<StockCount[]>('/gym/stock/counts').pipe(map((r) => unwrapList<StockCount>(r.data)));
  }

  count(id: string) {
    return this.api.get<StockCount>(`/gym/stock/counts/${encodeURIComponent(id)}`).pipe(map((r) => r.data));
  }

  createCount(body: { productIds?: string[]; notes?: string }) {
    return this.api.post<StockCount>('/gym/stock/counts', body).pipe(map((r) => r.data));
  }

  updateCount(id: string, body: { entries?: { productId: string; counted: number | null }[]; notes?: string }) {
    return this.api.patch<StockCount>(`/gym/stock/counts/${encodeURIComponent(id)}`, body).pipe(map((r) => r.data));
  }

  completeCount(id: string) {
    return this.api.post<StockCount>(`/gym/stock/counts/${encodeURIComponent(id)}/complete`, {}).pipe(map((r) => r.data));
  }

  cancelCount(id: string) {
    return this.api.post<StockCount>(`/gym/stock/counts/${encodeURIComponent(id)}/cancel`, {}).pipe(map((r) => r.data));
  }

  orders() {
    return this.api.get<PurchaseOrder[]>('/gym/stock/purchase-orders').pipe(map((r) => unwrapList<PurchaseOrder>(r.data)));
  }

  createOrder(body: PurchaseOrderInput) {
    return this.api.post<PurchaseOrder>('/gym/stock/purchase-orders', body).pipe(map((r) => r.data));
  }

  updateOrder(id: string, body: PurchaseOrderInput) {
    const { supplierId: _supplierId, ...rest } = body;
    return this.api.patch<PurchaseOrder>(`/gym/stock/purchase-orders/${encodeURIComponent(id)}`, rest).pipe(map((r) => r.data));
  }

  markOrdered(id: string) {
    return this.api.post<PurchaseOrder>(`/gym/stock/purchase-orders/${encodeURIComponent(id)}/order`, {}).pipe(map((r) => r.data));
  }

  receiveOrder(id: string, lines?: { productId: string; receivedQuantity: number }[]) {
    return this.api
      .post<PurchaseOrder>(`/gym/stock/purchase-orders/${encodeURIComponent(id)}/receive`, lines ? { lines } : {})
      .pipe(map((r) => r.data));
  }

  cancelOrder(id: string) {
    return this.api.post<PurchaseOrder>(`/gym/stock/purchase-orders/${encodeURIComponent(id)}/cancel`, {}).pipe(map((r) => r.data));
  }
}
