import { computed, signal } from '@angular/core';
import {
  renameWorkoutDay,
  shiftAfterRemovedDay,
  shiftPendingNames,
  workoutDayIndex,
  workoutDayLabel,
  workoutDayTabs,
} from './workout-day';

/**
 * Program editörlerinin gün durumu (aktif gün, boş günler, boş günlerin adları). Egzersizleri
 * editör tutar (signal dizisi ya da FormArray); bu sınıf yalnızca `dayName` değerlerini okur ve
 * `apply` ile her kaydın `dayName`ini dönüştürür (`null` → kaydı sil).
 */
export class WorkoutDayState {
  readonly active = signal(1);
  private readonly extra = signal(1);
  /** Henüz hareketi olmayan günlerin adları; hareket eklenince `dayName`'e geçer. */
  private readonly pendingNames = signal<Record<number, string>>({});

  readonly tabs = computed(() =>
    workoutDayTabs(this.dayNames(), Math.max(this.extra(), this.active()), this.pendingNames()),
  );

  constructor(
    private readonly dayNames: () => Array<string | null | undefined>,
    private readonly apply: (map: (dayName: string | null | undefined) => string | null) => void,
  ) {}

  /** Yeni hareketin `dayName`i: aktif gün ve varsa adı. */
  label(): string {
    const day = this.active();
    return workoutDayLabel(day, this.tabs().find((tab) => tab.day === day)?.name);
  }

  isActive(dayName: string | null | undefined): boolean {
    return workoutDayIndex(dayName) === this.active();
  }

  /** Yüklenen program için: günler egzersizlerden gelir, ilk gün seçilir. */
  reset(): void {
    this.pendingNames.set({});
    this.active.set(1);
    this.extra.set(Math.max(1, workoutDayTabs(this.dayNames()).length));
  }

  add(): void {
    const next = this.tabs().length + 1;
    this.extra.set(next);
    this.active.set(next);
  }

  rename(day: number, name: string): void {
    // Günü olmayan eski kayıtlar 1. gündür; `null` silme anlamına geldiği için etikete çevrilir.
    this.apply((dayName) => renameWorkoutDay(dayName, day, name) ?? workoutDayLabel(workoutDayIndex(dayName)));
    this.pendingNames.update((names) => ({ ...names, [day]: name }));
  }

  /** Günü ve hareketlerini siler; sonraki günler bir öne kayar. */
  remove(day: number): void {
    const remaining = Math.max(1, this.tabs().length - 1);
    this.apply((dayName) => shiftAfterRemovedDay(dayName, day));
    this.pendingNames.update((names) => shiftPendingNames(names, day));
    this.extra.set(remaining);
    this.active.set(Math.min(day, remaining));
  }
}
