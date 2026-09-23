import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MeasurementsService } from '../measurements.service';
import { AlertService } from '../../../core/services/alert.service';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';

@Component({
  selector: 'app-measurement-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="cancel()"></div>
      <div class="font-sans fixed inset-y-0 right-0 max-w-lg w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800">
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            {{ isEditMode() ? 'Ölçümü Düzenle' : 'Ölçüm Ekle' }}
          </h3>
          <button (click)="cancel()" class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
            <mat-icon class="icon-size-5" [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex-1 flex flex-col">
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Tarih</label>
              <input type="date" formControlName="date" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Kilo (kg)</label>
                <input type="number" formControlName="weight" step="0.1" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Bel (cm)</label>
                <input type="number" formControlName="waist" step="0.1" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Göğüs (cm)</label>
                <input type="number" formControlName="chest" step="0.1" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Kalça (cm)</label>
                <input type="number" formControlName="hips" step="0.1" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Not</label>
              <textarea formControlName="notes" rows="2" class="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 resize-none"></textarea>
            </div>
          </div>

          <div class="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
            <button type="button" (click)="cancel()" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer">
              Vazgeç
            </button>
            <button type="submit" [disabled]="submitting()" class="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              {{ submitting() ? 'Kaydediliyor…' : isEditMode() ? 'Güncelle' : 'Ekle' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class MeasurementDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(MeasurementsService);
  private readonly alertService = inject(AlertService);

  readonly open = input(false);
  readonly measurement = input<BodyMeasurement | null>(null);
  readonly closed = output<boolean>();

  protected readonly isEditMode = signal(false);
  protected readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    date: ['', [Validators.required]],
    weight: [0],
    waist: [0],
    chest: [0],
    hips: [0],
    bicep: [0],
    thigh: [0],
    calf: [0],
    bodyFatPercentage: [0],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const m = this.measurement();
      if (m) {
        this.isEditMode.set(true);
        const date = m.date.toDate();
        this.form.reset({
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          weight: m.weight || 0,
          waist: m.waist || 0,
          chest: m.chest || 0,
          hips: m.hips || 0,
          bicep: m.bicep || 0,
          thigh: m.thigh || 0,
          calf: m.calf || 0,
          bodyFatPercentage: m.bodyFatPercentage || 0,
          notes: m.notes || '',
        });
      } else if (this.open()) {
        this.isEditMode.set(false);
        const today = new Date();
        this.form.reset({
          date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
          weight: 0,
          waist: 0,
          chest: 0,
          hips: 0,
          bicep: 0,
          thigh: 0,
          calf: 0,
          bodyFatPercentage: 0,
          notes: '',
        });
      }
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);

    try {
      const value = this.form.getRawValue();
      const input = {
        date: new Date(value.date),
        weight: value.weight || undefined,
        waist: value.waist || undefined,
        chest: value.chest || undefined,
        hips: value.hips || undefined,
        bicep: value.bicep || undefined,
        thigh: value.thigh || undefined,
        calf: value.calf || undefined,
        bodyFatPercentage: value.bodyFatPercentage || undefined,
        notes: value.notes,
      };

      if (this.isEditMode() && this.measurement()) {
        await this.service.updateMeasurement(this.measurement()!.id, input);
      } else {
        await this.service.addMeasurement(input);
      }
      this.closed.emit(true);
    } catch {
      await this.alertService.error('İşlem Başarısız', 'Ölçüm kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.closed.emit(false);
  }
}
