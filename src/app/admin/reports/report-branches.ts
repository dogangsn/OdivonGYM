import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { BranchReport, GymReportsApi } from '../../core/api/gym-reports.api';
import { toAppError } from '../../shared/models/app-error.model';
import { BarDatum, LineSeries, OdvBarChart, OdvLineChart, seriesColor } from '../../shared/charts/odv-charts';

type RangeKey = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'this_month', label: 'Bu ay' },
  { key: 'last_month', label: 'Geçen ay' },
  { key: 'last_3_months', label: 'Son 3 ay' },
  { key: 'this_year', label: 'Bu yıl' },
];

const UNASSIGNED = 'unassigned';
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeOf(key: RangeKey, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'last_month':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'last_3_months':
      return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case 'this_year':
      return { from: `${y}-01-01`, to: ymd(now) };
    default:
      return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
  }
}

/** Çok şubeli konsolide rapor: şube başına üye, gelir/gider, giriş; aylık gelir trendi. */
@Component({
  selector: 'app-report-branches',
  standalone: true,
  imports: [MatIconModule, OdvBarChart, OdvLineChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="odv-card p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Çok Şubeli Konsolide Rapor</h3>
          <p class="m-0 text-xs text-slate-500 mt-0.5">
            Kayıt kendi şubesine, yoksa üyenin şubesine yazılır; ikisi de yoksa "Şubesi belirsiz" satırında görünür.
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          @for (r of ranges; track r.key) {
            <button type="button" class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    [class]="range() === r.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
                    (click)="load(r.key)">{{ r.label }}</button>
          }
          <button type="button" class="odv-btn-soft text-xs" [disabled]="!report()" (click)="exportCsv()">
            <mat-icon class="icon-size-4">download</mat-icon> CSV
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="m-0 text-sm text-rose-600">{{ error() }}</p>
      } @else if (!report()) {
        <p class="m-0 text-xs text-slate-400">Yükleniyor…</p>
      } @else {
        @let r = report()!;
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="odv-card p-4"><span class="text-xs text-slate-500">Toplam gelir</span>
            <div class="text-xl font-black text-slate-900 dark:text-white">{{ money(r.totals.revenue) }}</div></div>
          <div class="odv-card p-4"><span class="text-xs text-slate-500">Toplam gider</span>
            <div class="text-xl font-black text-slate-900 dark:text-white">{{ money(r.totals.expense) }}</div></div>
          <div class="odv-card p-4"><span class="text-xs text-slate-500">Net</span>
            <div class="text-xl font-black" [class]="r.totals.net < 0 ? 'text-rose-600' : 'text-emerald-600'">{{ money(r.totals.net) }}</div></div>
          <div class="odv-card p-4"><span class="text-xs text-slate-500">Aktif üye</span>
            <div class="text-xl font-black text-slate-900 dark:text-white">{{ r.totals.activeMembers }}</div>
            <span class="text-[11px] text-slate-400">{{ r.totals.newMembers }} yeni kayıt</span></div>
          <div class="odv-card p-4"><span class="text-xs text-slate-500">Turnike girişi</span>
            <div class="text-xl font-black text-slate-900 dark:text-white">{{ r.totals.checkIns }}</div>
            <span class="text-[11px] text-slate-400">günlük ort. {{ r.totals.avgDailyCheckIns }}</span></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div class="odv-card p-5">
            <h4 class="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Şubeye göre gelir ({{ r.days }} gün)</h4>
            <odv-bar-chart [data]="revenueBars()" [format]="money" [height]="150" ariaLabel="Şubelere göre gelir" />
          </div>
          <div class="odv-card p-5">
            <h4 class="m-0 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Aylık gelir (son 6 ay)</h4>
            <odv-line-chart [labels]="monthLabels()" [series]="monthlySeries()" [format]="money" [height]="150" ariaLabel="Şubelerin aylık geliri" />
          </div>
        </div>

        <div class="odv-card overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th class="p-3">Şube</th>
                <th class="p-3 text-right">Üye</th>
                <th class="p-3 text-right">Aktif</th>
                <th class="p-3 text-right">Yeni</th>
                <th class="p-3 text-right">Gelir</th>
                <th class="p-3 text-right">Gider</th>
                <th class="p-3 text-right">Net</th>
                <th class="p-3 text-right">Giriş</th>
                <th class="p-3 text-right">Günlük ort.</th>
                <th class="p-3 text-right">Doluluk</th>
                <th class="p-3 text-right">Gelir / aktif üye</th>
                <th class="p-3 text-right">Pay</th>
              </tr>
            </thead>
            <tbody>
              @for (row of r.rows; track row.branchId) {
                <tr class="border-b border-slate-50 dark:border-slate-800/60">
                  <td class="p-3 font-bold text-slate-900 dark:text-white">
                    <span class="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" [style.background]="colorOf(row.branchId)"></span>{{ row.branchName }}
                  </td>
                  <td class="p-3 text-right">{{ row.totalMembers }}</td>
                  <td class="p-3 text-right">{{ row.activeMembers }}</td>
                  <td class="p-3 text-right">{{ row.newMembers }}</td>
                  <td class="p-3 text-right font-semibold">{{ money(row.revenue) }}</td>
                  <td class="p-3 text-right">{{ money(row.expense) }}</td>
                  <td class="p-3 text-right font-semibold" [class.text-rose-600]="row.net < 0">{{ money(row.net) }}</td>
                  <td class="p-3 text-right">{{ row.checkIns }}</td>
                  <td class="p-3 text-right">{{ row.avgDailyCheckIns }}</td>
                  <td class="p-3 text-right">{{ occupancy(row.avgDailyCheckIns, row.capacity) }}</td>
                  <td class="p-3 text-right">{{ money(row.revenuePerActiveMember) }}</td>
                  <td class="p-3 text-right">%{{ row.revenueShare }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="font-black text-slate-900 dark:text-white">
                <td class="p-3">Toplam</td>
                <td class="p-3 text-right">{{ r.totals.totalMembers }}</td>
                <td class="p-3 text-right">{{ r.totals.activeMembers }}</td>
                <td class="p-3 text-right">{{ r.totals.newMembers }}</td>
                <td class="p-3 text-right">{{ money(r.totals.revenue) }}</td>
                <td class="p-3 text-right">{{ money(r.totals.expense) }}</td>
                <td class="p-3 text-right">{{ money(r.totals.net) }}</td>
                <td class="p-3 text-right">{{ r.totals.checkIns }}</td>
                <td class="p-3 text-right">{{ r.totals.avgDailyCheckIns }}</td>
                <td class="p-3 text-right">{{ occupancy(r.totals.avgDailyCheckIns, r.totals.capacity) }}</td>
                <td class="p-3 text-right">{{ money(r.totals.revenuePerActiveMember) }}</td>
                <td class="p-3 text-right">%100</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="m-0 text-[11px] text-slate-400">
          Doluluk: günlük ortalama giriş / şube kapasitesi. Gelir ve gider muhasebe kayıtlarından; turnike girişleri üyenin şubesine göre.
        </p>
      }
    </div>
  `,
})
export class ReportBranches {
  private readonly api = inject(GymReportsApi);

  protected readonly ranges = RANGES;
  protected readonly range = signal<RangeKey>('this_month');
  protected readonly report = signal<BranchReport | null>(null);
  protected readonly error = signal('');

  protected readonly money = (value: number) =>
    value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

  /** Renk şubeye sabit bağlı (ada göre sıra), gelire göre sıralama değişse de kaymaz; belirsiz = 8. renk. */
  private readonly colorIndex = computed(() => {
    const rows = this.report()?.rows ?? [];
    const named = rows
      .filter((row) => row.branchId !== UNASSIGNED)
      .sort((a, b) => a.branchName.localeCompare(b.branchName, 'tr'));
    const map = new Map(named.map((row, index) => [row.branchId, Math.min(index, 6)]));
    map.set(UNASSIGNED, 7);
    return map;
  });

  protected readonly revenueBars = computed<BarDatum[]>(() =>
    (this.report()?.rows ?? []).map((row) => ({ label: row.branchName, value: row.revenue })),
  );
  protected readonly monthLabels = computed(() =>
    (this.report()?.monthly ?? []).map((m) => new Date(`${m.month}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'short' })),
  );
  protected readonly monthlySeries = computed<LineSeries[]>(() => {
    const report = this.report();
    if (!report) return [];
    // En fazla 7 şube ayrı çizgi; kalanlar "Diğer" olarak toplanır (renk döngüsü yok).
    const rows = report.rows.filter((row) => row.branchId !== UNASSIGNED);
    const shown = rows.slice(0, 7);
    const rest = rows.slice(7).map((row) => row.branchId);
    const series: LineSeries[] = shown.map((row) => ({
      name: row.branchName,
      values: report.monthly.map((m) => m.revenue[row.branchId] ?? 0),
      colorIndex: this.colorIndex().get(row.branchId),
    }));
    const other = report.monthly.map(
      (m) => (m.revenue[UNASSIGNED] ?? 0) + rest.reduce((sum, id) => sum + (m.revenue[id] ?? 0), 0),
    );
    if (other.some((value) => value > 0)) series.push({ name: rest.length ? 'Diğer / belirsiz' : 'Şubesi belirsiz', values: other, colorIndex: 7 });
    return series;
  });

  constructor() {
    void this.load('this_month');
  }

  protected colorOf(branchId: string): string {
    return seriesColor(this.colorIndex().get(branchId) ?? 7);
  }

  protected occupancy(avgDaily: number, capacity: number | null): string {
    if (!capacity) return '—';
    return `%${Math.round((avgDaily / capacity) * 100)}`;
  }

  protected async load(key: RangeKey): Promise<void> {
    this.range.set(key);
    this.error.set('');
    this.report.set(null);
    const { from, to } = rangeOf(key);
    try {
      this.report.set(await firstValueFrom(this.api.branches(from, to)));
    } catch (err) {
      const e = toAppError(err);
      this.error.set(e.status === 403 ? 'Bu raporu görme yetkiniz yok.' : 'Rapor yüklenemedi, tekrar deneyin.');
    }
  }

  protected exportCsv(): void {
    const r = this.report();
    if (!r) return;
    const header = ['Şube', 'Üye', 'Aktif', 'Yeni', 'Gelir', 'Gider', 'Net', 'Giriş', 'Günlük ort.', 'Gelir/aktif üye', 'Pay %'];
    const lines = r.rows.map((row) => [
      row.branchName, row.totalMembers, row.activeMembers, row.newMembers, row.revenue, row.expense, row.net,
      row.checkIns, row.avgDailyCheckIns, row.revenuePerActiveMember, row.revenueShare,
    ]);
    const csv = [header, ...lines].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `odivon-sube-raporu-${r.from}_${r.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
