import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LeadFunnel, LeadsApi } from '../../core/api/leads.api';
import { toAppError } from '../../shared/models/app-error.model';
import { toDateInput } from '../../shared/ui/ui-utils';
import { sourceLabel, STAGE_LABEL } from './lead-labels';

/** Aday hunisi: seçilen tarih aralığında oluşturulan adayların aşamalara, kaynaklara ve personele göre dönüşümü. */
@Component({
  selector: 'app-lead-funnel',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <div class="odv-card p-4 flex flex-wrap items-end gap-3">
        <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
          Başlangıç
          <input type="date" class="odv-input mt-1" [ngModel]="from()" (ngModelChange)="from.set($event)" />
        </label>
        <label class="text-xs font-bold text-slate-600 dark:text-slate-300">
          Bitiş
          <input type="date" class="odv-input mt-1" [ngModel]="to()" (ngModelChange)="to.set($event)" />
        </label>
        <button type="button" class="odv-btn-primary" (click)="load()">Göster</button>
        <p class="m-0 text-[11px] text-slate-400 basis-full">Aralıkta oluşturulan adaylar sayılır; aşama geçmişi olmayan eski kayıtlar bugünkü durumuyla hesaplanır.</p>
      </div>

      @if (error()) {
        <p class="m-0 text-xs text-rose-600">{{ error() }}</p>
      } @else if (!report()) {
        <p class="m-0 text-xs text-slate-400">Yükleniyor…</p>
      } @else {
        @let r = report()!;
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div class="odv-card p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0">Aday</p>
            <p class="text-xl font-black text-slate-900 dark:text-white mt-1 mb-0">{{ r.total }}</p>
          </div>
          <div class="odv-card p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-500 m-0">Dönüşüm</p>
            <p class="text-xl font-black text-emerald-600 mt-1 mb-0">%{{ r.conversionRate }}</p>
            <p class="text-[10px] text-slate-400 m-0">{{ r.converted }} üye oldu</p>
          </div>
          <div class="odv-card p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0">Açık / Kayıp</p>
            <p class="text-xl font-black text-slate-900 dark:text-white mt-1 mb-0">{{ r.open }} / {{ r.lost }}</p>
          </div>
          <div class="odv-card p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0">Ort. Dönüşüm Süresi</p>
            <p class="text-xl font-black text-slate-900 dark:text-white mt-1 mb-0">{{ r.avgDaysToConvert === null ? '—' : r.avgDaysToConvert + ' gün' }}</p>
          </div>
          <div class="odv-card p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-rose-500 m-0">Takibi Geciken</p>
            <p class="text-xl font-black text-rose-600 mt-1 mb-0">{{ r.overdueFollowUps }}</p>
          </div>
        </div>

        <div class="odv-card p-5 space-y-3">
          <h3 class="m-0 text-sm font-bold text-slate-900 dark:text-white">Huni</h3>
          @for (s of r.stages; track s.stage) {
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="font-bold text-slate-700 dark:text-slate-300">{{ stageLabel[s.stage] }}</span>
                <span class="text-slate-500">{{ s.reached }} aday ulaştı · %{{ s.rate }} · şu an {{ s.current }}</span>
              </div>
              <div class="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div class="h-full rounded-full bg-indigo-500" [style.width.%]="s.rate"></div>
              </div>
            </div>
          }
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div class="odv-card overflow-x-auto">
            <p class="m-0 p-4 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">Kaynağa göre</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60">
                  <th class="odv-th text-left">Kaynak</th>
                  <th class="odv-th text-right">Aday</th>
                  <th class="odv-th text-right">Üye</th>
                  <th class="odv-th text-right">Oran</th>
                </tr>
              </thead>
              <tbody>
                @for (g of r.bySource; track g.key) {
                  <tr class="border-t border-slate-100 dark:border-slate-800">
                    <td class="odv-td font-bold">{{ source(g.key) }}</td>
                    <td class="odv-td text-right">{{ g.leads }}</td>
                    <td class="odv-td text-right">{{ g.converted }}</td>
                    <td class="odv-td text-right">%{{ g.conversionRate }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="odv-td text-center text-slate-400 py-6">Kayıt yok.</td></tr>
                }
              </tbody>
            </table>
          </div>

          <div class="odv-card overflow-x-auto">
            <p class="m-0 p-4 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">Personele göre</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60">
                  <th class="odv-th text-left">Personel</th>
                  <th class="odv-th text-right">Aday</th>
                  <th class="odv-th text-right">Üye</th>
                  <th class="odv-th text-right">Oran</th>
                </tr>
              </thead>
              <tbody>
                @for (g of r.byStaff; track g.key) {
                  <tr class="border-t border-slate-100 dark:border-slate-800">
                    <td class="odv-td font-bold">{{ g.key === 'unassigned' ? 'Atanmamış' : g.key }}</td>
                    <td class="odv-td text-right">{{ g.leads }}</td>
                    <td class="odv-td text-right">{{ g.converted }}</td>
                    <td class="odv-td text-right">%{{ g.conversionRate }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="odv-td text-center text-slate-400 py-6">Kayıt yok.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (r.lostReasons.length) {
          <div class="odv-card p-5">
            <h3 class="m-0 mb-3 text-sm font-bold text-slate-900 dark:text-white">Kayıp nedenleri</h3>
            <div class="flex flex-wrap gap-2">
              @for (l of r.lostReasons; track l.reason) {
                <span class="odv-badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ l.reason }} · {{ l.count }}</span>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class LeadFunnelReport {
  private readonly api = inject(LeadsApi);

  protected readonly stageLabel = STAGE_LABEL;
  protected readonly source = sourceLabel;
  protected readonly from = signal(toDateInput(new Date(Date.now() - 29 * 86_400_000)));
  protected readonly to = signal(toDateInput(new Date()));
  protected readonly report = signal<LeadFunnel | null>(null);
  protected readonly error = signal('');

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set('');
    try {
      this.report.set(await firstValueFrom(this.api.funnel({ from: this.from() || undefined, to: this.to() || undefined })));
    } catch (err) {
      this.error.set(toAppError(err).message || 'Huni raporu yüklenemedi.');
    }
  }
}
