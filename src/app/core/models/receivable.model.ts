export type ReceivablePaymentMethod = 'cash' | 'card' | 'transfer' | 'wallet';
export type ReceivableStatus = 'open' | 'paid' | 'cancelled';

export interface ReceivableInstallment {
  no: number;
  /** YYYY-MM-DD (salon saati) */
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidAt: string | null;
  status: 'pending' | 'partial' | 'paid';
  remainingAmount: number;
  overdue: boolean;
  daysLate: number;
}

export interface ReceivablePayment {
  id: string;
  kind: 'down_payment' | 'installment';
  amount: number;
  paymentMethod: ReceivablePaymentMethod;
  paidAt: string;
  recordedBy: string;
  note: string | null;
}

export interface Receivable {
  id: string;
  createdAt: string;
  userId: string;
  memberName: string;
  memberNumber: string | null;
  memberPhone: string | null;
  packageId: string;
  packageName: string;
  listPrice: number;
  discount: number;
  totalAmount: number;
  downPayment: number;
  financedAmount: number;
  installmentCount: number;
  payments: ReceivablePayment[];
  paidAmount: number;
  remainingAmount: number;
  status: ReceivableStatus;
  saleDate: string;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Kalan borç üyenin cüzdanında (-) bakiye olarak da görünür; e-cüzdandan tahsil edilemez. */
  walletLinked?: boolean;
  overdueAmount: number;
  overdueCount: number;
  maxDaysLate: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  installments: ReceivableInstallment[];
}

export interface DebtorRow {
  userId: string;
  memberName: string;
  memberNumber: string | null;
  memberPhone: string | null;
  openPlans: number;
  totalDebt: number;
  overdueAmount: number;
  overdueCount: number;
  maxDaysLate: number;
  nextDueDate: string | null;
  nextDueAmount: number;
}

export interface OverdueInstallmentRow {
  receivableId: string;
  userId: string;
  memberName: string;
  memberPhone: string | null;
  packageName: string;
  installmentNo: number;
  installmentCount: number;
  dueDate: string;
  amount: number;
  remainingAmount: number;
  daysLate: number;
}

export interface InstallmentSaleInput {
  userId: string;
  packageId: string;
  downPayment: number;
  installmentCount: number;
  firstDueDate?: string;
  discount?: number;
  paymentMethod?: ReceivablePaymentMethod;
  notes?: string;
}

export interface ReceivablePaymentInput {
  amount: number;
  paymentMethod: ReceivablePaymentMethod;
  note?: string;
}

export const RECEIVABLE_PAYMENT_LABELS: Record<ReceivablePaymentMethod, string> = {
  cash: 'Nakit',
  card: 'Kredi Kartı',
  transfer: 'Havale/EFT',
  wallet: 'E-Cüzdan',
};
