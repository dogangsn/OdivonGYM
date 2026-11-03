export interface GymBank {
  id: string;
  tenantId?: string;
  bankName: string;
  name?: string; // alias
  code?: string;
  branchName?: string;
  branchCode?: string;
  accountNumber?: string;
  iban?: string;
  currency?: string;
  hasPos: boolean;
  hasPosDevice?: boolean; // alias
  posTerminalNo?: string;
  posModel?: string;
  posCommissionRate?: number;
  commissionRate?: number; // alias
  isDefaultPos?: boolean;
  status: 'active' | 'inactive';
  isActive?: boolean; // alias
  colorTag?: string;
  icon?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGymBankInput {
  bankName: string;
  name?: string;
  code?: string;
  branchName?: string;
  branchCode?: string;
  accountNumber?: string;
  iban?: string;
  currency?: string;
  hasPos?: boolean;
  hasPosDevice?: boolean;
  posTerminalNo?: string;
  posModel?: string;
  posCommissionRate?: number;
  commissionRate?: number;
  isDefaultPos?: boolean;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  colorTag?: string;
  icon?: string;
  notes?: string;
}

export interface PresetBank {
  name: string;
  code: string;
  color: string;
  textColor: string;
  bgLight: string;
  borderLight: string;
  icon: string;
}

export const TURKISH_POPULAR_BANKS: PresetBank[] = [
  { name: 'Garanti BBVA', code: '0062', color: 'emerald', textColor: 'text-emerald-700 dark:text-emerald-300', bgLight: 'bg-emerald-50 dark:bg-emerald-950/50', borderLight: 'border-emerald-200 dark:border-emerald-800', icon: 'account_balance' },
  { name: 'Akbank', code: '0046', color: 'rose', textColor: 'text-rose-700 dark:text-rose-300', bgLight: 'bg-rose-50 dark:bg-rose-950/50', borderLight: 'border-rose-200 dark:border-rose-800', icon: 'account_balance' },
  { name: 'Yapı Kredi', code: '0067', color: 'blue', textColor: 'text-blue-700 dark:text-blue-300', bgLight: 'bg-blue-50 dark:bg-blue-950/50', borderLight: 'border-blue-200 dark:border-blue-800', icon: 'account_balance' },
  { name: 'Türkiye İş Bankası', code: '0064', color: 'indigo', textColor: 'text-indigo-700 dark:text-indigo-300', bgLight: 'bg-indigo-50 dark:bg-indigo-950/50', borderLight: 'border-indigo-200 dark:border-indigo-800', icon: 'account_balance' },
  { name: 'Ziraat Bankası', code: '0010', color: 'red', textColor: 'text-red-700 dark:text-red-300', bgLight: 'bg-red-50 dark:bg-red-950/50', borderLight: 'border-red-200 dark:border-red-800', icon: 'account_balance' },
  { name: 'Vakıfbank', code: '0015', color: 'amber', textColor: 'text-amber-700 dark:text-amber-300', bgLight: 'bg-amber-50 dark:bg-amber-950/50', borderLight: 'border-amber-200 dark:border-amber-800', icon: 'account_balance' },
  { name: 'Halkbank', code: '0012', color: 'sky', textColor: 'text-sky-700 dark:text-sky-300', bgLight: 'bg-sky-50 dark:bg-sky-950/50', borderLight: 'border-sky-200 dark:border-sky-800', icon: 'account_balance' },
  { name: 'QNB Finansbank', code: '0111', color: 'purple', textColor: 'text-purple-700 dark:text-purple-300', bgLight: 'bg-purple-50 dark:bg-purple-950/50', borderLight: 'border-purple-200 dark:border-purple-800', icon: 'account_balance' },
  { name: 'DenizBank', code: '0134', color: 'cyan', textColor: 'text-cyan-700 dark:text-cyan-300', bgLight: 'bg-cyan-50 dark:bg-cyan-950/50', borderLight: 'border-cyan-200 dark:border-cyan-800', icon: 'account_balance' },
  { name: 'Kuveyt Türk', code: '0205', color: 'teal', textColor: 'text-teal-700 dark:text-teal-300', bgLight: 'bg-teal-50 dark:bg-teal-950/50', borderLight: 'border-teal-200 dark:border-teal-800', icon: 'account_balance' },
  { name: 'TEB (Türk Ekonomi Bankası)', code: '0032', color: 'emerald', textColor: 'text-emerald-700 dark:text-emerald-300', bgLight: 'bg-emerald-50 dark:bg-emerald-950/50', borderLight: 'border-emerald-200 dark:border-emerald-800', icon: 'account_balance' },
  { name: 'Enpara.com', code: '0111-EN', color: 'purple', textColor: 'text-purple-700 dark:text-purple-300', bgLight: 'bg-purple-50 dark:bg-purple-950/50', borderLight: 'border-purple-200 dark:border-purple-800', icon: 'account_balance' },
];
