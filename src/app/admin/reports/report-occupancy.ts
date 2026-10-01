import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { GymReportsApi, HourlyOccupancy } from '../../core/api/gym-reports.api';
import { toAppError } from '../../shared/models/app-error.model';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const RANGES = [
  { days: 7, label: 'Son 7 gün' },
  { days: 28, label: 'Son 4 hafta' },
  { days: 90, label: 'Son 3 ay' },
];

/** Saatlik doluluk: turnike girişlerinden gün × saat ortalaması (ısı haritası). */
@Component({
  selector: 'app-report-occupancy',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="odv-card p-6 space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Saatlik Doluluk (gerçek turnike girişleri)</h3>
          <p class="m-0 text-xs text-slate-500 mt-0.5">Her hücre: o gün ve saatte ortalama giriş sayısı (İstanbul saati).</p>
        </div>
        <div class="flex gap-1.5">
          @for (r of ranges; track r.days) {
            <button type="button" class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    [class]="rangeDays() === r.days ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
                    (click)="load(r.days)">{{ r.label }}</button>
          }
        </div>
      </div>

      @if (error()) {
        <p class="m-0 text-xs text-rose-600">{{ error() }}</p>
      } @else if (!data()) {
        <p class="m-0 text-xs text-slate-400">Yükleniyor…</p>
      } @else if (data()!.totalEntries === 0) {
        <p class="m-0 text-sm text-slate-500 py-6 text-center">Bu aralıkta turnike giriş kaydı yok.</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span class="text-slate-500">Toplam giriş</span>
            <div class="text-xl font-black text-slate-900 dark:text-white">{{ data()!.totalEntries }}</div>
            <span class="text-slate-400">{{ data()!.days }} günde · günlük ort. {{ perDay() }}</span>
          </div>
          @if (data()!.peak; as p) {
            <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40">
              <span class="text-rose-600">En yoğun</span>
              <div class="text-xl font-black text-rose-700 dark:text-rose-300">{{ weekdayLong[p.weekday] }} {{ hour(p.hour) }}</div>
              <span class="text-rose-500">ortalama {{ p.average }} giriş</span>
            </div>
          }
          @if (data()!.quietest; as q) {
            <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <span class="text-emerald-600">En sakin</span>
              <div class="text-xl font-black text-emerald-700 dark:text-emerald-300">{{ weekdayLong[q.weekday] }} {{ hour(q.hour) }}</div>
              <span class="text-emerald-500">ortalama {{ q.average }} giriş</span>
            </div>
          }
        </div>

        <div class="overflow-x-auto">
          <table class="text-[10px] border-separate" style="border-spacing: 2px">
            <thead>
              <tr>
                <th></th>
                @for (h of hours(); track h) {
                  <th class="font-semibold text-slate-400 w-7">{{ h }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of data()!.averages; track $index; let wd = $index) {
                <tr>
                  <th class="pr-2 text-right font-bold text-slate-500">{{ weekdays[wd] }}</th>
                  @for (h of hours(); track h) {
                    <td class="w-7 h-6 rounded text-center font-bold"
                        [style.background]="cellColor(row[h])"
                        [class]="row[h] / max() > 0.55 ? 'text-white' : 'text-slate-600 dark:text-slate-300'"
                        [title]="weekdayLong[wd] + ' ' + hour(h) + ': ort. ' + row[h] + ' giriş'">
                      {{ row[h] > 0 ? row[h] : '' }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ReportOccupancy {
  private readonly api = inject(GymReportsApi);

  protected readonly ranges = RANGES;
  protected readonly weekdays = WEEKDAYS;
  protected readonly weekdayLong = WEEKDAY_LONG;
  protected readonly rangeDays = signal(28);
  protected readonly data = signal<HourlyOccupancy | null>(null);
  protected readonly error = signal('');

  /** Only the hours that ever had an entry (plus neighbours), so the grid stays readable. */
  protected readonly hours = computed(() => {
    const d = this.data();
    if (!d) return [];
    const used = d.hourly.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
    if (!used.length) return [];
    const from = Math.max(0, Math.min(...used) - 1);
    const to = Math.min(23, Math.max(...used) + 1);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  protected readonly max = computed(() => Math.max(0.1, ...(this.data()?.averages.flat() ?? [0])));
  protected readonly perDay = computed(() => {
    const d = this.data();
    return d && d.days ? Math.round((d.totalEntries / d.days) * 10) / 10 : 0;
  });

  constructor() {
    void this.load(28);
  }

  protected hour(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  protected cellColor(value: number): string {
    if (!value) return 'rgba(148, 163, 184, 0.12)';
    const t = Math.min(1, value / this.max());
    return `rgba(79, 70, 229, ${0.15 + t * 0.85})`;
  }

  protected async load(days: number): Promise<void> {
    this.rangeDays.set(days);
    this.error.set('');
    this.data.set(null);
    const to = istanbulToday();
    const from = addDays(to, -(days - 1));
    try {
      this.data.set(await firstValueFrom(this.api.hourly(from, to)));
    } catch (err) {
      this.error.set(toAppError(err).message || 'Doluluk raporu yüklenemedi.');
    }
  }
}

function istanbulToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
