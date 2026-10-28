import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WorkoutDayTab } from '../../../core/models/workout-day';

/**
 * Program editörlerinin gün şeridi: gün seçme, adlandırma, gün ekleme ve silme. Günler takvime
 * bağlı değildir ("1. Gün", "2. Gün"); ad çalışılan bölgeyi anlatır ("İtiş"), haftanın günü değil.
 * Durumu tutmaz; editör kendi egzersiz listesini `rename` / `remove` olaylarına göre günceller.
 */
@Component({
  selector: 'app-workout-day-tabs',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (tab of tabs(); track tab.day) {
        @if (editing() === tab.day) {
          <span class="flex items-center gap-1 rounded-xl border border-indigo-600 bg-white dark:bg-slate-900 pl-2.5 pr-1 py-0.5">
            <span class="text-xs font-black text-indigo-700 dark:text-indigo-300">{{ tab.day }}.</span>
            <input
              #nameInput
              type="text"
              maxlength="40"
              [value]="tab.name"
              placeholder="Bölge (ör. İtiş)"
              list="workout-day-name-suggestions"
              (keydown.enter)="commit(tab.day, nameInput.value)"
              (keydown.escape)="editing.set(null)"
              (blur)="commit(tab.day, nameInput.value)"
              class="w-32 h-7 bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden"
              [attr.aria-label]="tab.day + '. gün adı'"
              autofocus
            />
          </span>
        } @else {
          <span
            class="group flex items-center rounded-xl border transition-colors"
            [class]="active() === tab.day
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-indigo-300'"
          >
            <button type="button" (click)="select.emit(tab.day)" class="pl-3 pr-1.5 py-1.5 text-xs font-black cursor-pointer">
              {{ tab.day }}. {{ tab.name || 'Gün' }}
              @if (tab.count) {
                <span class="ml-1 font-semibold opacity-70">· {{ tab.count }}</span>
              }
            </button>
            @if (active() === tab.day) {
              <button type="button" (click)="editing.set(tab.day)" title="Günü adlandır" class="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/20 cursor-pointer">
                <mat-icon class="icon-size-3.5">edit</mat-icon>
              </button>
              @if (tabs().length > 1) {
                <button type="button" (click)="remove.emit(tab.day)" title="Günü sil" class="w-6 h-6 mr-1 rounded-md flex items-center justify-center hover:bg-white/20 cursor-pointer">
                  <mat-icon class="icon-size-3.5">close</mat-icon>
                </button>
              }
            }
          </span>
        }
      }
      <datalist id="workout-day-name-suggestions">
        @for (suggestion of suggestions; track suggestion) {
          <option [value]="suggestion"></option>
        }
      </datalist>
      <button
        type="button"
        (click)="add.emit()"
        class="px-3 py-1.5 rounded-xl text-xs font-bold border border-dashed border-indigo-300 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
      >
        + Gün
      </button>
    </div>
  `,
})
export class WorkoutDayTabs {
  readonly tabs = input.required<WorkoutDayTab[]>();
  readonly active = input.required<number>();

  readonly select = output<number>();
  readonly add = output<void>();
  readonly rename = output<{ day: number; name: string }>();
  readonly remove = output<number>();

  protected readonly editing = signal<number | null>(null);
  protected readonly suggestions = [
    'İtiş',
    'Çekiş',
    'Bacak',
    'Üst Vücut',
    'Alt Vücut',
    'Tüm Vücut',
    'Göğüs & Arka Kol',
    'Sırt & Ön Kol',
    'Omuz & Karın',
    'Kardiyo',
  ];

  protected commit(day: number, value: string): void {
    if (this.editing() !== day) return;
    this.editing.set(null);
    const current = this.tabs().find((tab) => tab.day === day)?.name ?? '';
    const name = value.trim();
    if (name !== current) this.rename.emit({ day, name });
  }
}
