import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WaterService } from '../water.service';
import { WaterLog, CreateWaterLogInput } from '../../../core/models/water-log.model';

@Component({
  selector: 'app-water-log-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 transition-opacity" (click)="cancel()"></div>

      <div class="font-sans fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800">
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ isEditMode() ? 'Su Kaydını Düzenle' : 'Su Kaydı Ekle' }}
          </h3>
          <button (click)="cancel()" class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
            <mat-icon class="icon-size-5" [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex-1 flex flex-col">
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Tarih <span class="text-rose-500">*</span>
              </label>
              <input
                type="date"
                formControlName="date"
                class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Miktar <span class="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  formControlName="amount"
                  min="0"
                  step="50"
                  class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Birim <span class="text-rose-500">*</span>
                </label>
                <select formControlName="unit" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <option value="ml">ml</option>
                  <option value="liter">Litre</option>
                  <option value="cup">Bardak</option>
                  <option value="bottle">Şişe</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Not
              </label>
              <textarea
                formControlName="notes"
                rows="2"
                class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 resize-none"
              ></textarea>
            </div>
          </div>

          <div class="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
            <button
              type="button"
              (click)="cancel()"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              [disabled]="submitting()"
              class="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {{ submitting() ? 'Kaydediliyor…' : isEditMode() ? 'Güncelle' : 'Ekle' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class WaterLogDialog {
  private readonly fb = inject(FormBuilder);
  private readonly waterService = inject(WaterService);

  readonly open = input(false);
  readonly log = input<WaterLog | null>(null);
  readonly closed = output<boolean>();

  protected readonly isEditMode = signal(false);
  protected readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    date: ['', [Validators.required]],
    amount: [250, [Validators.required, Validators.min(1)]],
    unit: ['ml' as any, [Validators.required]],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const logData = this.log();
      if (logData) {
        this.isEditMode.set(true);
        const date = logData.date.toDate();
        this.form.reset({
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          amount: logData.amount,
          unit: logData.unit,
          notes: logData.notes || '',
        });
      } else if (this.open()) {
        this.isEditMode.set(false);
        const today = new Date();
        this.form.reset({
          date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
          amount: 250,
          unit: 'ml',
          notes: '',
        });
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);

    try {
      const value = this.form.getRawValue();
      if (this.isEditMode() && this.log()) {
        await this.waterService.updateLog(this.log()!.id, {
          date: new Date(value.date),
          amount: value.amount,
          unit: value.unit,
          notes: value.notes,
        });
      } else {
        await this.waterService.addLog({
          date: new Date(value.date),
          amount: value.amount,
          unit: value.unit,
          notes: value.notes,
        });
      }
      this.closed.emit(true);
    } catch {
      alert('Hata oluştu');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
