export interface IncomeSummary {
  cash: number;
  posCard: number;
  bankTransfer: number;
  wallet: number;
  total: number;
  packageSaleCount: number;
  shopSaleCount: number;
  receivableCollectionCount: number;
  totalTransactionCount: number;
}

export interface ExpenseSummary {
  cash: number;
  bank: number;
  total: number;
  count: number;
}

export interface BankPosClosing {
  bankId: string;
  bankName: string;
  terminalNo?: string;
  posTerminalNo?: string; // alias
  expectedPos: number;
  actualPos: number;
  difference: number;
  slipCount?: number;
  isSlipPrinted?: boolean;
  slipNotes?: string;
}

export interface GymDailyClosing {
  id: string;
  tenantId?: string;
  closingNumber: string; // 'Z-20261002-001'
  date: string; // 'YYYY-MM-DD'
  branchId?: string;
  branchName?: string;
  closedByStaffId: string;
  closedByStaffName: string;

  // Opening float
  openingCash: number;

  // Summaries
  incomeSummary: IncomeSummary;
  expenseSummary: ExpenseSummary;

  // Expected vs Counted
  expectedCash: number;
  actualCashCounted: number;
  cashDifference: number; // actual - expected (+ surplus, - shortage)

  expectedPos: number;
  actualPosCounted: number;
  posDifference: number;

  // Bank POS Details (Ayrı Ayrı Banka Gün Sonu Slipleri)
  bankPosClosings?: BankPosClosing[];

  // Carry-over & Bank Deposit
  retainedCashForNextDay: number;
  bankDepositAmount: number;

  notes?: string;
  status: 'draft' | 'closed' | 'verified';
  closedAt: string;
  verifiedByStaffId?: string;
  verifiedByStaffName?: string;
  verifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PreClosePreviewResponse {
  date: string;
  branchId?: string;
  openingCash: number;
  incomeSummary: IncomeSummary;
  expenseSummary: ExpenseSummary;
  expectedCash: number;
  expectedPos: number;
  bankPosExpected?: Array<{ bankId: string; bankName: string; terminalNo?: string; expectedPos: number }>;
  isAlreadyClosed: boolean;
  existingClosing?: GymDailyClosing;
}

export interface SubmitDailyCloseDto {
  date: string;
  branchId?: string;
  branchName?: string;
  actualCashCounted: number;
  actualPosCounted?: number;
  bankPosClosings?: BankPosClosing[];
  retainedCashForNextDay?: number;
  bankDepositAmount?: number;
  notes?: string;
}

export interface DailyCloseReminderSettings {
  id?: string;
  tenantId?: string;
  enabled: boolean;
  reminderTime: string; // 'HH:mm'
  days?: string[]; // ['0','1','2','3','4','5','6']
  notifyInApp?: boolean;
}

export interface UpdateDailyCloseReminderSettingsDto {
  enabled: boolean;
  reminderTime: string;
  days?: string[];
  notifyInApp?: boolean;
}

export interface CategoryExpenseBreakdown {
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface ExpenseAnalyticsResponse {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  expenseMarginPercentage: number;
  topCategory: CategoryExpenseBreakdown | null;
  categoryBreakdown: CategoryExpenseBreakdown[];
  monthlyTrend: MonthlyTrendItem[];
}
