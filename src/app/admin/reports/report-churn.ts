import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChurnMonth, GymReportsApi } from '../../core/api/gym-reports.api';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDate } from '../../shared/ui/ui-utils';

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Churn: ay içinde süresi biten ve yenilemeyen üye oranı + takip listesi. */
@Component({
  selector: 'app-report-churn',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="odv-card p-6 space-y-4">
        <div>
          <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Aylık Churn (kayıp) Oranı</h3>
          <p class="m-0 text-xs text-slate-500 mt-0.5">
            Ay içinde süresi biten üyelerden yenilemeyenlerin oranı. Ay içinde yenileyen üye "yenileyen" sayılır.
          </p>
        </div>
        @if (error()) {
          <p class="m-0 text-xs text-rose-600">{{ error() }}</p>
        } @else if (!months()) {
          <p class="m-0 text-xs text-slate-400">Yükleniyor…</p>
        } @else {
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            @for (m of months(); track m.month) {
              <button type="button" class="p-3 rounded-xl text-left border cursor-pointer transition-colors"
                      [class]="selected()?.month === m.month ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'"
                      (click)="selectedMonth.set(m.month)">
                <span class="block text-[11px] font-bold text-slate-500">{{ monthLabel(m.month) }}</span>
                <span class="block text-xl font-black" [class]="rateClass(m.churnRate)">{{ m.churnRate === null ? '—' : '%' + m.churnRate }}</span>
                <span class="block text-[10px] text-slate-400">{{ m.churnedCount }} kayıp / {{ m.dueCount }} biten</span>
              </button>
            }
          </div>
        }
      </div>

      @if (selected(); as m) {
        <div class="odv-card overflow-x-auto">
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <p class="m-0 text-sm font-bold text-slate-900 dark:text-white">{{ monthLabel(m.month) }}: yenilemeyen üyeler ({{ m.churnedCount }})</p>
            <p class="m-0 text-xs text-slate-500">Yenileyen: <b>{{ m.renewedCount }}</b></p>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/60">
                <th class="odv-th text-left">Üye</th>
                <th class="odv-th text-left">Paket</th>
                <th class="odv-th text-left">Bitiş</th>
                <th class="odv-th text-left">Telefon</th>
              </tr>
            </thead>
            <tbody>
              @for (c of m.churned; track c.uid) {
                <tr class="border-t border-slate-100 dark:border-slate-800">
                  <td class="odv-td font-bold text-slate-900 dark:text-white">{{ c.displayName }}</td>
                  <td class="odv-td">{{ c.packageLabel || '—' }}</td>
                  <td class="odv-td">{{ date(c.endedAt) }}</td>
                  <td class="odv-td">
                    @if (c.phone) {
                      <a class="text-indigo-600" [href]="'tel:' + c.phone">{{ c.phone }}</a>
                    } @else {
                      —
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="odv-td text-center text-slate-400 py-8">Bu ay yenilemeyen üye yok.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ReportChurn {
  private readonly api = inject(GymReportsApi);

  protected readonly date = formatDate;
  protected readonly months = signal<ChurnMonth[] | null>(null);
  protected readonly error = signal('');
  protected readonly selectedMonth = signal<string | null>(null);
  /** Varsayılan: geçen ay (bu ay henüz bitmedi). */
  protected readonly selected = computed(() => {
    const list = this.months() ?? [];
    return list.find((m) => m.month === this.selectedMonth()) ?? list.at(-2) ?? list.at(-1) ?? null;
  });

  constructor() {
    void this.load();
  }

  protected monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  protected rateClass(rate: number | null): string {
    if (rate === null) return 'text-slate-400';
    if (rate >= 40) return 'text-rose-600';
    if (rate >= 20) return 'text-amber-600';
    return 'text-emerald-600';
  }

  private async load(): Promise<void> {
    try {
      this.months.set(await firstValueFrom(this.api.churn(6)));
    } catch (err) {
      this.error.set(toAppError(err).message || 'Churn raporu yüklenemedi.');
    }
  }
}
