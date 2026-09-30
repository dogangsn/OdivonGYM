import { toAppError } from '../../shared/models/app-error.model';

/**
 * Sunucudaki taksit hesabının (MainApi receivables.math) istemci kopyası: satış ekranındaki
 * önizleme kaydedilecek planla birebir aynı olsun diye tüm hesap kuruş üzerinden yapılır.
 */
export const toKurus = (amount: number): number => Math.round((Number(amount) || 0) * 100);
export const toTl = (kurus: number): number => kurus / 100;

export function gymToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addMonths(date: string, months: number, anchorDay?: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = month - 1 + months;
  const targetYear = year + Math.floor(index / 12);
  const targetMonth = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(anchorDay ?? day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export interface PreviewInstallment {
  no: number;
  dueDate: string;
  amount: number;
}

export function previewSchedule(financed: number, count: number, firstDueDate: string): PreviewInstallment[] {
  const total = toKurus(financed);
  if (total <= 0 || count < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) return [];
  const base = Math.floor(total / count);
  const anchorDay = Number(firstDueDate.slice(8, 10));
  return Array.from({ length: count }, (_, index) => ({
    no: index + 1,
    dueDate: addMonths(firstDueDate, index, anchorDay),
    amount: toTl(index === count - 1 ? total - base * (count - 1) : base),
  }));
}

/** `YYYY-MM-DD` → `05.10.2026` */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

const MESSAGES: [RegExp, string][] = [
  [/exceeds the remaining debt/i, 'Tahsilat tutarı kalan borçtan fazla olamaz.'],
  [/whole price/i, 'Peşinat paket tutarının tamamını karşılıyor; normal paket satışı yapın.'],
  [/Discount must be lower/i, 'İndirim paket fiyatından düşük olmalı.'],
  [/firstDueDate/i, 'İlk vade bugünden önce olamaz.'],
  [/Insufficient wallet balance/i, 'Üyenin e-cüzdan bakiyesi yetersiz.'],
  [/already on the wallet/i, 'Bu borç zaten cüzdanda eksi bakiye olarak görünüyor; nakit, kart ya da havale ile tahsil edin.'],
  [/paidAmount must be between/i, 'Tahsil edilen tutar 0 ile paket fiyatı arasında olmalı.'],
  [/Receivable is (paid|cancelled)/i, 'Bu plan kapanmış; tahsilat alınamaz.'],
  [/archived/i, 'Arşivlenmiş üyeye satış yapılamaz.'],
  [/not available for sale/i, 'Bu paket satışa kapalı.'],
  [/Insufficient role|Missing permission/i, 'Bu işlem için yetkiniz yok.'],
];

export function receivableErrorMessage(error: unknown, fallback: string): string {
  const message = toAppError(error).message ?? '';
  return MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? (message || fallback);
}
