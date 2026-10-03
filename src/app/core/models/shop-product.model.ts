import { Timestamp } from '@angular/fire/firestore';

export interface ShopProduct {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  price: number; // TL
  stock: number;
  category: string;
  description?: string;
  imageUrl?: string;
  supplier?: string;
  supplierId?: string; // tedarikçi kaydı (sipariş için)
  minStock?: number; // bu ve altı "düşük stok" (tanımsızsa 5)
  reorderQty?: number; // düşük stokta önerilen sipariş miktarı
  cost?: number; // cost price for profit calculation
  status: 'active' | 'inactive' | 'discontinued';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShopSale {
  id: string;
  tenantId: string;
  userId?: string; // optional, might be walk-in customer
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number; // total price
  paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
  discount?: number; // amount or percentage
  notes?: string;
  saleDate: Timestamp;
  status: 'completed' | 'refunded' | 'pending';
  items?: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalAmount?: number;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateShopProductInput {
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  imageUrl?: string;
  supplier?: string;
  supplierId?: string;
  minStock?: number;
  reorderQty?: number;
  cost?: number;
}

export type UpdateShopProductInput = Partial<Omit<CreateShopProductInput, 'sku'>> & { status?: ShopProduct['status'] };

export interface CreateShopSaleInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
  userId?: string;
  discount?: number;
  notes?: string;
}

/** Düşük stok eşiği: ürünün minimumu, tanımsızsa 5 (MainApi `/gym/stock/low` ile aynı kural). */
export function isLowStock(p: Pick<ShopProduct, 'stock' | 'minStock'>): boolean {
  return (p.stock ?? 0) <= (typeof p.minStock === 'number' && p.minStock >= 0 ? p.minStock : 5);
}
