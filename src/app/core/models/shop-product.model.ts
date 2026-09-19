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
  cost?: number;
}

export type UpdateShopProductInput = Partial<Omit<CreateShopProductInput, 'sku'>>;

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
