import { AbstractControl } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';

type MaybeTs = Timestamp | null | undefined;

/** `serverTimestamp()` yazımı henüz sunucuya ulaşmadıysa `null` gelir — onu "en yeni" sayarız. */
function millis(ts: MaybeTs): number {
  return ts?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
}

export function sortDesc<T>(list: readonly T[], pick: (item: T) => MaybeTs): T[] {
  return [...list].sort((a, b) => millis(pick(b)) - millis(pick(a)));
}

export function sortAsc<T>(list: readonly T[], pick: (item: T) => MaybeTs): T[] {
  return [...list].sort((a, b) => millis(pick(a)) - millis(pick(b)));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `<input type="date">` için "yyyy-MM-dd". */
export function toDateInput(value: MaybeTs | Date): string {
  const d = value instanceof Date ? value : value?.toDate?.();
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/** `<input type="datetime-local">` için "yyyy-MM-ddTHH:mm". */
export function toDateTimeInput(value: MaybeTs | Date): string {
  const d = value instanceof Date ? value : value?.toDate?.();
  return d ? `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

export function todayInput(): string {
  return toDateInput(new Date());
}

/** "yyyy-MM-dd" metnini yerel saatte o günün başlangıcına çevirir (`new Date('yyyy-MM-dd')` UTC verir). */
export function fromDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(ts: MaybeTs): string {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function formatDateTime(ts: MaybeTs): string {
  const d = ts?.toDate?.();
  return d
    ? d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

export function formatMoney(amount: number | null | undefined): string {
  return `₺${(amount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Boş bırakılabilen sayı alanı: '' / null → undefined. */
export function optionalNumber(value: unknown): number | undefined {
  return value === '' || value === null || value === undefined ? undefined : Number(value);
}

/** Her satırı (ya da virgülle ayrılmış her parçayı) bir öğe olarak ayırır. */
export function splitLines(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function firstError(control: AbstractControl, messages: Record<string, string>): string {
  if (!control.touched || !control.errors) return '';
  const key = Object.keys(control.errors)[0];
  return messages[key] ?? '';
}
