import { Timestamp } from '@angular/fire/firestore';

export interface AccountingEntry {
  id: string;
  tenantId: string;
  type: 'income' | 'expense';
  amount: number; // TL
  category: string; // membership, product, service, utilities, salary, etc.
  description: string;
  referenceId?: string; // link to transaction/sale
  referenceType?: 'membership' | 'product-sale' | 'class' | 'pt' | 'other';
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'wallet';
  notes?: string;
  entryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAccountingEntryInput {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  referenceId?: string;
  referenceType?: 'membership' | 'product-sale' | 'class' | 'pt' | 'other';
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'wallet';
  notes?: string;
  entryDate: Date;
}

export type UpdateAccountingEntryInput = Partial<Omit<CreateAccountingEntryInput, 'referenceId'>>;
