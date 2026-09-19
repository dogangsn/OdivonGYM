import { Timestamp } from '@angular/fire/firestore';

export interface WalletTransaction {
  id: string;
  userId: string;
  tenantId: string;
  type: 'deposit' | 'debit' | 'refund';
  amount: number; // TL
  description: string;
  referenceId?: string; // class, PT, product sale, etc.
  referenceType?: 'class' | 'pt' | 'product' | 'package' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'promotion';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateWalletTransactionInput {
  type: 'deposit' | 'debit' | 'refund';
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: 'class' | 'pt' | 'product' | 'package' | 'other';
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'promotion';
  notes?: string;
}
