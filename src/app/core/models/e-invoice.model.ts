import { Timestamp } from '@angular/fire/firestore';

export type InvoiceProvider = 'uyumsoft' | 'gib_portal' | 'parasut';
export type InvoiceStatus = 'draft' | 'queued' | 'signed' | 'sent' | 'rejected';
export type InvoiceType = 'earswive' | 'commercial' | 'basic';

export interface EInvoiceConfig {
  tenantId: string;
  provider: InvoiceProvider;
  username: string;
  companyTitle: string;
  companyVkn: string;
  apiKey?: string;
  isTestEnvironment: boolean;
  autoSendOnPayment: boolean;
  prefix: string; // Örn: 'UYM' veya 'ODV'
  updatedAt: Timestamp;
}

export interface EInvoiceItem {
  id: string;
  tenantId: string;
  invoiceNumber: string; // Örn: UYM202600000042
  recipientName: string;
  recipientVknOrTckn: string;
  amount: number; // KDV hariç tutar
  kdvRate: number; // %20, %10 vb.
  kdvAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  provider: InvoiceProvider;
  issueDate: Timestamp;
  gibUuid?: string; // GİB Evrensel Benzersiz Kimliği
  description?: string;
  pdfUrl?: string;
  createdAt: Timestamp;
}

export interface CreateInvoiceInput {
  recipientName: string;
  recipientVknOrTckn: string;
  amount: number;
  kdvRate?: number;
  invoiceType: InvoiceType;
  description?: string;
}
