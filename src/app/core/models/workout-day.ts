/** Antrenman programındaki gün etiketi: "1. Gün", "2. Gün". */
export function workoutDayLabel(day: number): string {
  const index = Number.isFinite(day) && day > 0 ? Math.floor(day) : 1;
  return `${index}. Gün`;
}

/** "1. Gün", "2. Gün: İtiş" gibi kayıtlardan gün numarasını okur. Gün yoksa 1. */
export function workoutDayIndex(dayName?: string | null): number {
  const match = /^(\d+)\s*\./.exec((dayName ?? '').trim());
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function workoutDayNumbers(names: Array<string | null | undefined>, minimum = 1): number[] {
  const highest = names.reduce((max, name) => Math.max(max, workoutDayIndex(name)), minimum);
  return Array.from({ length: Math.max(1, highest) }, (_, index) => index + 1);
}
