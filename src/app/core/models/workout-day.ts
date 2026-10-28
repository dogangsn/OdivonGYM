/**
 * Program günleri düz egzersiz listesinde `dayName` ile tutulur: "1. Gün" ya da "2. Gün: Çekiş".
 * API (`OdivonMainApi` workout-plan.normalize.ts) aynı biçimi ayrıştırıp `days[]` üretir; gün adı
 * böylece mobilde ve eski Flutter uygulamasında da görünür.
 */

/** "1. Gün" veya adı varsa "1. Gün: İtiş". */
export function workoutDayLabel(day: number, name?: string | null): string {
  const index = Number.isFinite(day) && day > 0 ? Math.floor(day) : 1;
  const title = (name ?? '').trim();
  return title ? `${index}. Gün: ${title}` : `${index}. Gün`;
}

/** "1. Gün", "2. Gün: İtiş" gibi kayıtlardan gün numarasını okur. Gün yoksa 1. */
export function workoutDayIndex(dayName?: string | null): number {
  const match = /^(\d+)\s*\./.exec((dayName ?? '').trim());
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** "2. Gün: İtiş" → "İtiş"; numarasız eski kayıtlarda ("Göğüs Günü") metnin kendisi. */
export function workoutDayName(dayName?: string | null): string {
  const value = (dayName ?? '').trim();
  const match = /^\d+\s*\.\s*(?:Gün|Day)?\s*:?\s*(.*)$/i.exec(value);
  return (match ? match[1] : value).trim();
}

export function workoutDayNumbers(names: Array<string | null | undefined>, minimum = 1): number[] {
  const highest = names.reduce((max, name) => Math.max(max, workoutDayIndex(name)), minimum);
  return Array.from({ length: Math.max(1, highest) }, (_, index) => index + 1);
}

/** Gün sekmesi: numara, ad ve o gündeki hareket sayısı. */
export interface WorkoutDayTab {
  day: number;
  name: string;
  count: number;
}

/**
 * Sekmeler: egzersizlerin günleri + henüz hareketi olmayan eklenmiş günler (`minimum`).
 * Boş günlerin adı `pendingNames` içinde tutulur (egzersiz eklenince `dayName`'e geçer).
 */
export function workoutDayTabs(
  dayNames: Array<string | null | undefined>,
  minimum = 1,
  pendingNames: Record<number, string> = {},
): WorkoutDayTab[] {
  return workoutDayNumbers(dayNames, minimum).map((day) => {
    const onDay = dayNames.filter((name) => workoutDayIndex(name) === day);
    const named = onDay.map(workoutDayName).find(Boolean);
    return { day, name: named ?? pendingNames[day] ?? '', count: onDay.length };
  });
}

/** Günün adını değiştirir; o güne ait her kaydın `dayName`'i güncellenir. */
export function renameWorkoutDay(dayName: string | null | undefined, day: number, name: string): string | null | undefined {
  return workoutDayIndex(dayName) === day ? workoutDayLabel(day, name) : dayName;
}

/**
 * Gün silindiğinde sonraki günler bir öne kayar ("3. Gün: Bacak" → "2. Gün: Bacak").
 * Silinen güne ait kayıtlar için `null` döner; çağıran onları listeden çıkarır.
 */
export function shiftAfterRemovedDay(dayName: string | null | undefined, removed: number): string | null {
  const day = workoutDayIndex(dayName);
  if (day === removed) return null;
  const label = dayName?.trim() || workoutDayLabel(day);
  return day > removed ? workoutDayLabel(day - 1, workoutDayName(label)) : label;
}

/** Gün numarasına bağlı kayıtlar (boş gün adları, gün kas grupları) silmeden sonra doğru günde kalsın. */
export function shiftPendingNames<T>(names: Record<number, T>, removed: number): Record<number, T> {
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(names)) {
    const day = Number(key);
    if (day < removed) next[day] = value;
    else if (day > removed) next[day - 1] = value;
  }
  return next;
}
