import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { WaterService } from '../water.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { WaterLogDialog } from './water-log-dialog';
import { WaterLog } from '../../../core/models/water-log.model';
import { formatDate, sortDesc } from '../../../shared/ui/ui-utils';

@Component({
  selector: 'app-water-tracker',
  standalone: true,
  imports: [PageHeader, MatIconModule, FormsModule, WaterLogDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="Su Takibi"
        icon="water_drop"
        description="Günlük su hedefini belirle, içtikçe işaretle."
      />

      <!-- Daily Summary -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">Günün Hedefi</p>
            <p class="text-3xl font-bold text-slate-900 dark:text-white">2500 ml</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">İçilen</p>
            <p class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ totalToday() }} ml</p>
          </div>
          <div class="text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-2">Kalan</p>
            <p class="text-3xl font-bold" [class]="remaining() > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
              {{ remaining() }} ml
            </p>
          </div>
        </div>
      </div>

      <!-- Add Log Button -->
      <button
        (click)="openAddDialog()"
        class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <mat-icon class="icon-size-4.5">add</mat-icon>
        <span>Su Ekle</span>
      </button>

      <!-- Logs List -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        @if (logs(); as logsList) {
          @if (logsList.length > 0) {
            <div class="overflow-x-auto custom-scroll">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th class="py-3.5 px-6">Tarih</th>
                    <th class="py-3.5 px-6">Miktar</th>
                    <th class="py-3.5 px-6">Not</th>
                    <th class="py-3.5 px-6 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                  @for (log of logsList; track log.id) {
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td class="py-3 px-6 text-slate-700 dark:text-slate-200">
                        {{ formatDate(log.date) }}
                      </td>
                      <td class="py-3 px-6">
                        <span class="font-semibold text-slate-900 dark:text-white">{{ log.amount }} {{ log.unit }}</span>
                      </td>
                      <td class="py-3 px-6 text-slate-500 dark:text-slate-400">
                        {{ log.notes || '—' }}
                      </td>
                      <td class="py-3 px-6 text-right">
                        <button
                          (click)="openEditDialog(log)"
                          class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
                        </button>
                        <button
                          (click)="deleteLog(log.id)"
                          class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center justify-center transition-colors cursor-pointer ml-1"
                        >
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
              <p class="text-sm text-slate-500 dark:text-slate-400">Henüz kayıt yok</p>
              <button
                (click)="openAddDialog()"
                class="mt-4 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
              >
                + İlk Su Kaydını Ekle
              </button>
            </div>
          }
        }
      </div>
    </div>

    <app-water-log-dialog [open]="dialogOpen()" [log]="selectedLog()" (closed)="onDialogClosed($event)" />
  `,
})
export class WaterTracker {
  private readonly waterService = inject(WaterService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  private readonly rawLogs = toSignal(this.waterService.watchLogs(), { initialValue: [] as WaterLog[] });
  protected readonly logs = computed(() => sortDesc(this.rawLogs(), (l) => l.date));
  protected readonly dialogOpen = signal(false);
  protected readonly selectedLog = signal<any>(null);

  protected readonly totalToday = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.logs()
      .filter(log => {
        const logDate = log.date.toDate();
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === today.getTime();
      })
      .reduce((sum, log) => {
        const amount = log.unit === 'liter' ? log.amount * 1000 : log.unit === 'cup' ? log.amount * 250 : log.unit === 'bottle' ? log.amount * 500 : log.amount;
        return sum + amount;
      }, 0);
  });

  protected readonly remaining = computed(() => Math.max(0, 2500 - this.totalToday()));

  openAddDialog(): void {
    this.selectedLog.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(log: WaterLog): void {
    this.selectedLog.set(log);
    this.dialogOpen.set(true);
  }

  async deleteLog(id: string): Promise<void> {
    if (await this.alertService.deleteConfirm('Su Tüketim Kaydı')) {
      try {
        await this.waterService.deleteLog(id);
        this.alertService.toastSuccess('Kayıt silindi.');
      } catch {
        this.alertService.toastError('Hata oluştu.');
      }
    }
  }

  onDialogClosed(saved: boolean): void {
    this.dialogOpen.set(false);
    if (saved) {
      this.snackBar.open(this.selectedLog() ? 'Güncellendi' : 'Eklendi', 'Kapat', { duration: 2000 });
    }
    this.selectedLog.set(null);
  }

  formatDate = formatDate;
}
