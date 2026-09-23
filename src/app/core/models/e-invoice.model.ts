import { Timestamp } from '@angular/fire/firestore';

export type InvoiceProvider =
  | 'manuel'
  | 'gib_portal'
  | 'uyumsoft'
  | 'sovos_foriba'
  | 'qnb_efinans'
  | 'parasut';

export type InvoiceStatus = 'draft' | 'queued' | 'signed' | 'sent' | 'paid' | 'rejected';
export type InvoiceType = 'sales' | 'purchase' | 'earswive' | 'commercial' | 'basic' | 'refund';
export type InvoiceDirection = 'outbound' | 'inbound'; // Satış (giden) / Alış (gelen gider/tedarikçi)

export interface InvoiceLineItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  kdvRate: number; // 20, 10, 1, 0
  total: number; // KDV hariç
  kdvAmount: number;
  grandTotal: number;
}

export interface EInvoiceConfig {
  tenantId: string;
  provider: InvoiceProvider;
  username: string;
  companyTitle: string;
  companyVkn: string;
  apiKey?: string;
  apiSecret?: string;
  webServiceUrl?: string;
  isTestEnvironment: boolean;
  autoSendOnPayment: boolean;
  prefix: string; // Örn: 'GIB', 'ODV', 'FAT'
  taxOffice?: string;
  address?: string;
  phone?: string;
  email?: string;
  updatedAt: Timestamp;
}

export interface EInvoiceItem {
  id: string;
  tenantId: string;
  invoiceNumber: string; // Örn: GIB202600000042 veya FAT-10023
  direction: InvoiceDirection;
  recipientName: string;
  recipientVknOrTckn: string;
  recipientTaxOffice?: string;
  recipientAddress?: string;
  amount: number; // KDV hariç toplam matrah
  kdvRate: number; // %20, %10 vb.
  kdvAmount: number;
  totalAmount: number; // KDV dahil genel toplam
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  provider: InvoiceProvider;
  issueDate: Timestamp;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'open_account';
  paymentStatus?: 'paid' | 'pending' | 'partial';
  gibUuid?: string; // GİB Evrensel Benzersiz Kimliği
  description?: string;
  notes?: string;
  items?: InvoiceLineItem[];
  pdfUrl?: string;
  createdAt: Timestamp;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string;
  direction?: InvoiceDirection;
  recipientName: string;
  recipientVknOrTckn: string;
  recipientTaxOffice?: string;
  recipientAddress?: string;
  amount: number;
  kdvRate?: number;
  invoiceType: InvoiceType;
  provider?: InvoiceProvider;
  issueDate?: Date | string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'open_account';
  paymentStatus?: 'paid' | 'pending' | 'partial';
  description?: string;
  notes?: string;
  items?: InvoiceLineItem[];
}
