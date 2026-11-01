export interface UserShortcut {
  id: string;
  title: string;
  link: string;
  icon: string;
  color: 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'slate';
  hotkey?: string; // Örn: 'Alt+1', 'Alt+2'
  order: number;
}

export interface AvailablePageOption {
  title: string;
  link: string;
  icon: string;
  category: string;
  defaultColor: UserShortcut['color'];
}

export const SHORTCUT_COLOR_THEMES: Record<
  UserShortcut['color'],
  {
    label: string;
    pillClass: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
    dotClass: string;
  }
> = {
  indigo: {
    label: 'İndigo',
    pillClass: 'bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 hover:bg-indigo-100',
    borderClass: 'border-indigo-400',
    bgClass: 'bg-indigo-500',
    textClass: 'text-indigo-600',
    dotClass: 'bg-indigo-500',
  },
  emerald: {
    label: 'Zümrüt',
    pillClass: 'bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100',
    borderClass: 'border-emerald-400',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
    dotClass: 'bg-emerald-500',
  },
  amber: {
    label: 'Kehribar',
    pillClass: 'bg-amber-50/90 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100',
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-600',
    dotClass: 'bg-amber-500',
  },
  purple: {
    label: 'Mor',
    pillClass: 'bg-purple-50/90 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100',
    borderClass: 'border-purple-400',
    bgClass: 'bg-purple-500',
    textClass: 'text-purple-600',
    dotClass: 'bg-purple-500',
  },
  rose: {
    label: 'Gül / Kırmızı',
    pillClass: 'bg-rose-50/90 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100',
    borderClass: 'border-rose-400',
    bgClass: 'bg-rose-500',
    textClass: 'text-rose-600',
    dotClass: 'bg-rose-500',
  },
  cyan: {
    label: 'Camgöbeği',
    pillClass: 'bg-cyan-50/90 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800/60 hover:bg-cyan-100',
    borderClass: 'border-cyan-400',
    bgClass: 'bg-cyan-500',
    textClass: 'text-cyan-600',
    dotClass: 'bg-cyan-500',
  },
  slate: {
    label: 'Gri / Nötr',
    pillClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200',
    borderClass: 'border-slate-400',
    bgClass: 'bg-slate-500',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-500',
  },
};

export const DEFAULT_USER_SHORTCUTS: UserShortcut[] = [
  {
    id: 'sc_members',
    title: 'Üyeler',
    link: '/admin/members',
    icon: 'groups',
    color: 'indigo',
    hotkey: 'Alt+1',
    order: 0,
  },
  {
    id: 'sc_pos',
    title: 'Kasa / POS',
    link: '/admin/shop',
    icon: 'shopping_cart_checkout',
    color: 'emerald',
    hotkey: 'Alt+2',
    order: 1,
  },
  {
    id: 'sc_einvoice',
    title: 'E-Fatura',
    link: '/admin/e-invoice',
    icon: 'receipt_long',
    color: 'purple',
    hotkey: 'Alt+3',
    order: 2,
  },
  {
    id: 'sc_products',
    title: 'Ürün & Stok',
    link: '/admin/products',
    icon: 'inventory_2',
    color: 'cyan',
    hotkey: 'Alt+4',
    order: 3,
  },
];
