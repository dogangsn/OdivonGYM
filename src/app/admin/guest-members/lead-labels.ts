import { LeadSource, LeadStage } from '../../core/models/guest-member.model';

export const STAGE_LABEL: Record<LeadStage, string> = {
  visited: 'Ziyaret Etti',
  called: 'Telefonla Görüşüldü',
  trial: 'Deneme Antrenmanı',
  converted: 'Üyeye Dönüştü',
  lost: 'İlgilenmiyor / İptal',
};

export const STAGE_CLASS: Record<LeadStage, string> = {
  visited: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  called: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  trial: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  lost: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const SOURCE_LABEL: Record<LeadSource | 'unknown', string> = {
  walk_in: 'Salona gelerek',
  instagram: 'Instagram',
  google: 'Google',
  website: 'Web sitesi',
  phone: 'Telefon',
  referral: 'Üye tavsiyesi',
  campaign: 'Kampanya',
  other: 'Diğer',
  unknown: 'Belirtilmemiş',
};

export const SOURCES = Object.keys(SOURCE_LABEL).filter((key) => key !== 'unknown') as LeadSource[];

export function sourceLabel(key: string | null | undefined): string {
  return SOURCE_LABEL[(key || 'unknown') as LeadSource] ?? key ?? '—';
}
