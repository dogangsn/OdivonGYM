import { Timestamp } from '@angular/fire/firestore';

export interface ExitPaymentItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export type ExitPaymentStatus = 'open' | 'collected' | 'cancelled';

export interface ExitPayment {
  id: string;
  tenantId: string;
  note: string;
  customerName?: string;
  userId?: string | null;
  items: ExitPaymentItem[];
  totalAmount: number;
  status: ExitPaymentStatus;
  paymentMethod?: 'cash' | 'card' | 'wallet' | 'transfer';
  collectedAmount?: number;
  collectedAt?: Timestamp | string;
  cancelledAt?: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface CreateExitPaymentInput {
  note: string;
  customerName?: string;
  userId?: string | null;
  totalAmount?: number;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CollectExitPaymentInput {
  paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
  totalAmount?: number;
  userId?: string | null;
}
