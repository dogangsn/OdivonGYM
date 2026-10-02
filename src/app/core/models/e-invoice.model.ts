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
  unit?: string; // 'Adet', 'Ay', 'Gün', 'Seans', 'Paket', 'Saat'
  unitPrice: number;
  discountRate?: number; // % iskonto
  discountAmount?: number;
  kdvRate: number; // 20, 10, 1, 0
  total: number; // KDV hariç net matrah
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
  mersisNo?: string;
  tradeRegistryNo?: string;
  website?: string;
  iban?: string;
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
  recipientDistrict?: string;
  recipientCity?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  amount: number; // KDV hariç toplam matrah
  discountTotal?: number; // Toplam iskonto
  kdvRate: number; // %20, %10 vb.
  kdvAmount: number;
  totalAmount: number; // KDV dahil genel toplam
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  invoiceProfile?: 'EARSIVFATURA' | 'TICARIFATURA' | 'TEMELFATURA' | 'KAMU' | 'IHRACAT';
  invoiceTypeCode?: 'SATIS' | 'IADE' | 'TEVKIFAT' | 'ISTISNA' | 'OZELMATRAH';
  provider: InvoiceProvider;
  issueDate: Timestamp;
  issueTime?: string; // '14:32:05'
  currency?: string; // 'TRY'
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'open_account';
  paymentStatus?: 'paid' | 'pending' | 'partial';
  gibUuid?: string; // GİB Evrensel Benzersiz Kimliği (ETTN UUID)
  description?: string;
  notes?: string;
  isDeliveryNoteReplacement?: boolean; // İrsaliye yerine geçer
  memberId?: string;
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
  recipientDistrict?: string;
  recipientCity?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  amount: number;
  discountTotal?: number;
  kdvRate?: number;
  invoiceType: InvoiceType;
  invoiceProfile?: 'EARSIVFATURA' | 'TICARIFATURA' | 'TEMELFATURA' | 'KAMU' | 'IHRACAT';
  invoiceTypeCode?: 'SATIS' | 'IADE' | 'TEVKIFAT' | 'ISTISNA' | 'OZELMATRAH';
  provider?: InvoiceProvider;
  issueDate?: Date | string;
  issueTime?: string;
  currency?: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'open_account';
  paymentStatus?: 'paid' | 'pending' | 'partial';
  gibUuid?: string;
  description?: string;
  notes?: string;
  isDeliveryNoteReplacement?: boolean;
  memberId?: string;
  items?: InvoiceLineItem[];
}
