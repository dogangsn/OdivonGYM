import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { sortDesc } from '../../../shared/ui/ui-utils';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { MeasurementsService } from '../measurements.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { MeasurementDialog } from './measurement-dialog';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';

@Component({
  selector: 'app-body-measurements',
  standalone: true,
  imports: [PageHeader, MatIconModule, MeasurementDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="Vücut Ölçümleri"
        icon="monitor_weight"
        description="Kilo, yağ oranı ve diğer ölçümlerini zaman içindeki grafiklerle takip et."
      />

      <button
        (click)="openAddDialog()"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer"
      >
        <mat-icon class="icon-size-4.5">add</mat-icon>
        <span>Ölçüm Ekle</span>
      </button>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        @if (measurements(); as list) {
          @if (list.length > 0) {
            <div class="overflow-x-auto custom-scroll">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th class="py-3.5 px-6">Tarih</th>
                    <th class="py-3.5 px-6">Kilo (kg)</th>
                    <th class="py-3.5 px-6">Bel (cm)</th>
                    <th class="py-3.5 px-6">Göğüs (cm)</th>
                    <th class="py-3.5 px-6 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                  @for (m of list; track m.id) {
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td class="py-3 px-6 font-semibold text-slate-900 dark:text-white">{{ formatDate(m.date) }}</td>
                      <td class="py-3 px-6 text-slate-700 dark:text-slate-200">{{ m.weight ? m.weight + ' kg' : '—' }}</td>
                      <td class="py-3 px-6 text-slate-700 dark:text-slate-200">{{ m.waist ? m.waist + ' cm' : '—' }}</td>
                      <td class="py-3 px-6 text-slate-700 dark:text-slate-200">{{ m.chest ? m.chest + ' cm' : '—' }}</td>
                      <td class="py-3 px-6 text-right space-x-1">
                        <button (click)="openEditDialog(m)" class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 inline-flex items-center justify-center cursor-pointer">
                          <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
                        </button>
                        <button (click)="deleteMeasurement(m.id)" class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 inline-flex items-center justify-center cursor-pointer">
                          <mat-icon class="icon-size-4">delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="py-12 text-center">
              <p class="text-sm text-slate-500 dark:text-slate-400">Henüz ölçüm kaydı yok</p>
              <button (click)="openAddDialog()" class="mt-4 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold cursor-pointer">
                + İlk Ölçümü Ekle
              </button>
            </div>
          }
        }
      </div>
    </div>

    <app-measurement-dialog [open]="dialogOpen()" [measurement]="selectedMeasurement()" (closed)="onDialogClosed($event)" />
  `,
})
export class BodyMeasurements {
  private readonly service = inject(MeasurementsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  private readonly rawMeasurements = toSignal(this.service.watchMeasurements(), { initialValue: [] as BodyMeasurement[] });
  protected readonly measurements = computed(() => sortDesc(this.rawMeasurements(), (m) => m.date));
  protected readonly dialogOpen = signal(false);
  protected readonly selectedMeasurement = signal<any>(null);

  openAddDialog(): void {
    this.selectedMeasurement.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(m: BodyMeasurement): void {
    this.selectedMeasurement.set(m);
    this.dialogOpen.set(true);
  }

  async deleteMeasurement(id: string): Promise<void> {
    if (await this.alertService.deleteConfirm('Vücut Ölçümü')) {
      try {
        await this.service.deleteMeasurement(id);
        this.alertService.toastSuccess('Ölçüm silindi.');
      } catch {
        this.alertService.toastError('Hata oluştu.');
      }
    }
  }

  onDialogClosed(saved: boolean): void {
    this.dialogOpen.set(false);
    if (saved) {
      this.snackBar.open(this.selectedMeasurement() ? 'Güncellendi' : 'Eklendi', 'Kapat', { duration: 2000 });
    }
    this.selectedMeasurement.set(null);
  }

  formatDate(timestamp: any): string {
    const date = timestamp.toDate();
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
