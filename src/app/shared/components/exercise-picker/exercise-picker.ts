import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MUSCLE_GROUP_LABELS, MuscleGroup } from '../../../core/models/gym-equipment.model';
import { Exercise } from '../../../core/models/workout-plan.model';
import { ExerciseCatalogService } from '../../../core/services/exercise-catalog.service';

/** Aksan/büyük harf duyarsız arama: "gogus" → "Göğüs". */
function fold(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * API egzersiz kataloğundan arama + kas grubu + ekipman filtresiyle hareket seçtirir.
 * Seçilen hareket varsayılan set/tekrar/dinlenme ile `pick` olarak döner; editör onu aktif güne ekler.
 */
@Component({
  selector: 'app-exercise-picker',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2.5">
      <div class="flex flex-wrap gap-2">
        <label class="relative flex-1 min-w-48">
          <mat-icon class="icon-size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">search</mat-icon>
          <input
            type="search"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            placeholder="Hareket ara (ör. squat, göğüs, kablo)"
            class="w-full h-9 pl-8 pr-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:outline-hidden font-medium"
          />
        </label>
        <select
          [value]="equipment()"
          (change)="equipment.set($any($event.target).value)"
          class="h-9 px-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-hidden font-medium"
          aria-label="Ekipman"
        >
          <option value="">Tüm ekipmanlar</option>
          @for (item of equipmentOptions(); track item) {
            <option [value]="item">{{ item }}</option>
          }
        </select>
      </div>

      <div class="flex flex-wrap gap-1">
        <button type="button" (click)="muscle.set('')" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer" [class]="chipClass(muscle() === '')">Tümü</button>
        @for (group of muscleGroups; track group.key) {
          <button type="button" (click)="muscle.set(group.key)" class="px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer" [class]="chipClass(muscle() === group.key)">
            {{ group.label }}
          </button>
        }
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-y-auto custom-scroll" [style.max-height.px]="maxHeight()">
        @for (item of results(); track item.exerciseId ?? item.name) {
          <div class="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
            <div class="min-w-0 flex-1">
              <p class="m-0 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {{ item.name }}
                @if (isGymExercise(item)) {
                  <span class="ml-1 px-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">Salon</span>
                }
              </p>
              <p class="m-0 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {{ muscleLabel(item.muscleGroup) }}@if (item.equipmentName) { · {{ item.equipmentName }} } · {{ item.sets }} × {{ item.reps }}
              </p>
            </div>
            <button
              type="button"
              (click)="pick.emit(item)"
              [title]="item.name + ' ekle'"
              class="w-8 h-8 shrink-0 rounded-full border-2 border-indigo-500 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <mat-icon class="icon-size-4">add</mat-icon>
            </button>
          </div>
        } @empty {
          <p class="m-0 p-4 text-center text-xs text-slate-500">
            "{{ query() }}" için katalogda hareket yok. Özel hareket olarak ekleyebilirsin.
          </p>
        }
      </div>
    </div>
  `,
})
export class ExercisePicker {
  private readonly catalog = inject(ExerciseCatalogService);

  /** Liste yüksekliği (px); kaydırılabilir. */
  readonly maxHeight = input(260);
  readonly pick = output<Exercise>();

  protected readonly query = signal('');
  protected readonly muscle = signal<MuscleGroup | ''>('');
  protected readonly equipment = signal('');

  protected readonly muscleGroups = (Object.entries(MUSCLE_GROUP_LABELS) as [MuscleGroup, string][]).map(([key, label]) => ({
    key,
    label: label.split(' ')[0],
  }));

  protected readonly equipmentOptions = computed(() =>
    [...new Set(this.catalog.presets().map((item) => item.equipmentName).filter((name): name is string => !!name))].sort((a, b) =>
      a.localeCompare(b, 'tr'),
    ),
  );

  protected readonly results = computed(() => {
    const needle = fold(this.query());
    const muscle = this.muscle();
    const equipment = this.equipment();
    return this.catalog
      .presets()
      .filter((item) => !muscle || item.muscleGroup === muscle)
      .filter((item) => !equipment || item.equipmentName === equipment)
      .filter((item) => !needle || fold(`${item.name} ${item.equipmentName ?? ''} ${this.muscleLabel(item.muscleGroup)}`).includes(needle));
  });

  protected muscleLabel(group?: MuscleGroup): string {
    return group ? (MUSCLE_GROUP_LABELS[group] ?? group).split(' ')[0] : '';
  }

  protected isGymExercise(item: Exercise): boolean {
    return !!item.exerciseId && !item.exerciseId.startsWith('sys-ex-');
  }

  protected chipClass(active: boolean): string {
    return active
      ? 'bg-indigo-600 text-white'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
  }
}
