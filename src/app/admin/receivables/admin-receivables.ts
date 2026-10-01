import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ReceivablesApi } from '../../core/api/receivables.api';
import {
  DebtorRow,
  OverdueInstallmentRow,
  Receivable,
  RECEIVABLE_PAYMENT_LABELS,
  ReceivablePaymentMethod,
  ReceivableStatus,
} from '../../core/models/receivable.model';
import { AlertService } from '../../core/services/alert.service';
import { PermissionService } from '../../core/services/permission.service';
import { InstallmentSaleDialog } from '../../shared/components/installment-sale-dialog/installment-sale-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatDateTime, formatMoney } from '../../shared/ui/ui-utils';
import { formatDay, gymToday, receivableErrorMessage, toKurus, toTl } from './installment-math';

type Tab = 'debtors' | 'overdue' | 'plans';

const STATUS_LABEL: Record<ReceivableStatus, string> = { open: 'Açık', paid: 'Kapandı', cancelled: 'İptal' };

@Component({
  selector: 'app-admin-receivables',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, PageHeader, InstallmentSaleDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="Taksit & Borç Takibi"
        icon="event_repeat"
        description="Taksitli ve kısmi ödemeli paket satışları: üye bazında kalan borç, vadeler ve gecikmeler."
      >
        <div actions class="flex items-center gap-2">
          <button type="button" class="odv-btn-soft" (click)="reload()" [disabled]="loading()">
            <mat-icon class="icon-size-4">refresh</mat-icon>
            <span>Yenile</span>
          </button>
          <button type="button" class="odv-btn-primary" (click)="saleOpen.set(true)">
            <mat-icon class="icon-size-4.5">add</mat-icon>
            <span>Taksitli Satış</span>
          </button>
        </div>
      </app-page-header>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">Toplam Alacak</p>
          <p class="m-0 mt-1 text-2xl font-black text-slate-900 dark:text-white">{{ money(kpi().totalDebt) }}</p>
          <p class="m-0 mt-1 text-[11px] text-slate-400">{{ kpi().debtorCount }} üye · {{ kpi().openPlans }} açık plan</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">Vadesi Geçen</p>
          <p class="m-0 mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{{ money(kpi().overdueAmount) }}</p>
          <p class="m-0 mt-1 text-[11px] text-slate-400">{{ overdueRows().length }} taksit gecikmede</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">Geciken Üye</p>
          <p class="m-0 mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{{ kpi().lateMembers }}</p>
          <p class="m-0 mt-1 text-[11px] text-slate-400">en uzun gecikme {{ kpi().maxDaysLate }} gün</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">Önümüzdeki 7 Gün</p>
          <p class="m-0 mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">{{ money(kpi().dueSoonAmount) }}</p>
          <p class="m-0 mt-1 text-[11px] text-slate-400">{{ kpi().dueSoonCount }} taksit vadesi geliyor</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex gap-2">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              (click)="tab.set(t.id)"
              class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              [class]="tab() === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
            >
              {{ t.label }}
            </button>
          }
        </div>
        @if (tab() === 'plans') {
          <select class="odv-input" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
            <option value="all">Tüm durumlar</option>
            <option value="open">Açık</option>
            <option value="paid">Kapandı</option>
            <option value="cancelled">İptal</option>
          </select>
        }
        <input class="odv-input flex-1 min-w-[200px]" type="search" placeholder="Üye adı, no veya telefon ara…"
               [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </div>

      <div class="odv-card overflow-x-auto">
        @switch (tab()) {
          @case ('debtors') {
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60">
                  <th class="odv-th text-left">Üye</th>
                  <th class="odv-th text-right">Kalan Borç</th>
                  <th class="odv-th text-right">Vadesi Geçen</th>
                  <th class="odv-th text-center">Gecikme</th>
                  <th class="odv-th text-left">Sıradaki Vade</th>
                  <th class="odv-th"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of debtorRows(); track row.userId) {
                  <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td class="odv-td">
                      <div class="font-bold text-slate-900 dark:text-white">{{ row.memberName }}</div>
                      <div class="text-[11px] text-slate-400">
                        #{{ row.memberNumber || row.userId.slice(0, 5) }}
                        @if (row.memberPhone) { · <a class="text-indigo-600" [href]="'tel:' + row.memberPhone">{{ row.memberPhone }}</a> }
                        · {{ row.openPlans }} plan
                      </div>
                    </td>
                    <td class="odv-td text-right font-black">{{ money(row.totalDebt) }}</td>
                    <td class="odv-td text-right font-bold" [class.text-rose-600]="row.overdueAmount > 0">
                      {{ row.overdueAmount > 0 ? money(row.overdueAmount) : '—' }}
                    </td>
                    <td class="odv-td text-center">
                      @if (row.maxDaysLate > 0) {
                        <span class="odv-badge" [class]="lateClass(row.maxDaysLate)">{{ row.maxDaysLate }} gün</span>
                      } @else {
                        <span class="odv-badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Güncel</span>
                      }
                    </td>
                    <td class="odv-td">
                      {{ day(row.nextDueDate) }}
                      @if (row.nextDueDate) { <span class="text-[11px] text-slate-400">· {{ money(row.nextDueAmount) }}</span> }
                    </td>
                    <td class="odv-td text-right">
                      <button type="button" class="odv-btn-soft !py-1.5 !text-xs" (click)="openMember(row.userId)">
                        <mat-icon class="icon-size-4">payments</mat-icon>
                        <span>Detay / Tahsilat</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td class="odv-td text-center text-slate-400 py-10" colspan="6">{{ loading() ? 'Yükleniyor…' : 'Borçlu üye yok.' }}</td></tr>
                }
              </tbody>
            </table>
          }
          @case ('overdue') {
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60">
                  <th class="odv-th text-left">Üye</th>
                  <th class="odv-th text-left">Paket</th>
                  <th class="odv-th text-center">Taksit</th>
                  <th class="odv-th text-left">Vade</th>
                  <th class="odv-th text-center">Gecikme</th>
                  <th class="odv-th text-right">Kalan</th>
                  <th class="odv-th"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of overdueRows(); track row.receivableId + '-' + row.installmentNo) {
                  <tr class="border-t border-slate-100 dark:border-slate-800">
                    <td class="odv-td">
                      <div class="font-bold text-slate-900 dark:text-white">{{ row.memberName }}</div>
                      @if (row.memberPhone) {
                        <a class="text-[11px] text-indigo-600" [href]="'tel:' + row.memberPhone">{{ row.memberPhone }}</a>
                      }
                    </td>
                    <td class="odv-td">{{ row.packageName }}</td>
                    <td class="odv-td text-center">{{ row.installmentNo }}/{{ row.installmentCount }}</td>
                    <td class="odv-td">{{ day(row.dueDate) }}</td>
                    <td class="odv-td text-center"><span class="odv-badge" [class]="lateClass(row.daysLate)">{{ row.daysLate }} gün</span></td>
                    <td class="odv-td text-right font-black text-rose-600">
                      {{ money(row.remainingAmount) }}
                      @if (row.remainingAmount < row.amount) {
                        <div class="text-[10px] font-medium text-slate-400">/ {{ money(row.amount) }}</div>
                      }
                    </td>
                    <td class="odv-td text-right">
                      <button type="button" class="odv-btn-soft !py-1.5 !text-xs" (click)="openPlan(row.receivableId)">
                        <mat-icon class="icon-size-4">payments</mat-icon>
                        <span>Tahsilat</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td class="odv-td text-center text-slate-400 py-10" colspan="7">{{ loading() ? 'Yükleniyor…' : 'Geciken taksit yok. 🎉' }}</td></tr>
                }
              </tbody>
            </table>
          }
          @case ('plans') {
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-800/60">
                  <th class="odv-th text-left">Üye</th>
                  <th class="odv-th text-left">Paket</th>
                  <th class="odv-th text-left">Satış</th>
                  <th class="odv-th text-right">Tutar</th>
                  <th class="odv-th text-right">Ödenen</th>
                  <th class="odv-th text-right">Kalan</th>
                  <th class="odv-th text-center">Durum</th>
                  <th class="odv-th"></th>
                </tr>
              </thead>
              <tbody>
                @for (plan of planRows(); track plan.id) {
                  <tr class="border-t border-slate-100 dark:border-slate-800">
                    <td class="odv-td font-bold text-slate-900 dark:text-white">{{ plan.memberName }}</td>
                    <td class="odv-td">{{ plan.packageName }} <span class="text-[11px] text-slate-400">· {{ plan.installmentCount }} taksit</span></td>
                    <td class="odv-td">{{ dateTime(plan.saleDate) }}</td>
                    <td class="odv-td text-right">{{ money(plan.totalAmount) }}</td>
                    <td class="odv-td text-right text-emerald-600 font-bold">{{ money(plan.paidAmount) }}</td>
                    <td class="odv-td text-right font-black">{{ money(plan.remainingAmount) }}</td>
                    <td class="odv-td text-center">
                      <span class="odv-badge" [class]="statusClass(plan)">{{ statusText(plan) }}</span>
                    </td>
                    <td class="odv-td text-right">
                      <button type="button" class="odv-icon-btn" (click)="openPlan(plan.id)" matTooltip="Detay">
                        <mat-icon class="icon-size-4.5">chevron_right</mat-icon>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td class="odv-td text-center text-slate-400 py-10" colspan="8">{{ loading() ? 'Yükleniyor…' : 'Kayıt yok.' }}</td></tr>
                }
              </tbody>
            </table>
          }
        }
      </div>
    </div>

    <!-- Üye / plan detayı -->
    @if (panelPlans().length > 0) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50" (click)="closePanel()"></div>
      <div class="font-sans fixed inset-y-0 right-0 max-w-2xl w-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 class="m-0 text-lg font-black text-slate-900 dark:text-white">{{ panelPlans()[0].memberName }}</h3>
            <p class="m-0 text-xs text-slate-500">
              Kalan toplam borç <b class="text-slate-900 dark:text-white">{{ money(panelDebt()) }}</b>
              @if (panelPlans()[0].memberPhone) { · <a class="text-indigo-600" [href]="'tel:' + panelPlans()[0].memberPhone">{{ panelPlans()[0].memberPhone }}</a> }
            </p>
          </div>
          <button type="button" class="odv-icon-btn" (click)="closePanel()" aria-label="Kapat">
            <mat-icon class="icon-size-5">close</mat-icon>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-5 custom-scroll">
          @for (plan of panelPlans(); track plan.id) {
            <section class="odv-card p-4 space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div class="font-black text-slate-900 dark:text-white">{{ plan.packageName }}</div>
                  <div class="text-[11px] text-slate-400">
                    Satış {{ dateTime(plan.saleDate) }} · Tutar {{ money(plan.totalAmount) }}
                    @if (plan.discount > 0) { (indirim {{ money(plan.discount) }}) }
                    · Peşinat {{ money(plan.downPayment) }}
                  </div>
                  @if (plan.notes) { <div class="text-[11px] text-slate-500 mt-0.5">Not: {{ plan.notes }}</div> }
                </div>
                <span class="odv-badge" [class]="statusClass(plan)">{{ statusText(plan) }}</span>
              </div>

              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-800/60">
                    <th class="odv-th text-left">#</th>
                    <th class="odv-th text-left">Vade</th>
                    <th class="odv-th text-right">Tutar</th>
                    <th class="odv-th text-right">Ödenen</th>
                    <th class="odv-th text-center">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of plan.installments; track item.no) {
                    <tr class="border-t border-slate-100 dark:border-slate-800">
                      <td class="odv-td">{{ item.no }}/{{ plan.installmentCount }}</td>
                      <td class="odv-td">{{ day(item.dueDate) }}</td>
                      <td class="odv-td text-right">{{ money(item.amount) }}</td>
                      <td class="odv-td text-right">{{ item.paidAmount > 0 ? money(item.paidAmount) : '—' }}</td>
                      <td class="odv-td text-center">
                        @if (item.status === 'paid') {
                          <span class="odv-badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Ödendi</span>
                        } @else if (item.overdue) {
                          <span class="odv-badge" [class]="lateClass(item.daysLate)">{{ item.daysLate }} gün gecikti</span>
                        } @else if (item.status === 'partial') {
                          <span class="odv-badge bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">Kısmi</span>
                        } @else {
                          <span class="odv-badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Bekliyor</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>

              @if (plan.payments.length > 0) {
                <details class="text-xs">
                  <summary class="cursor-pointer font-bold text-slate-600 dark:text-slate-300">Ödeme geçmişi ({{ plan.payments.length }})</summary>
                  <ul class="m-0 mt-2 p-0 list-none space-y-1">
                    @for (p of plan.payments; track p.id) {
                      <li class="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                        <span>{{ dateTime(p.paidAt) }} · {{ p.kind === 'down_payment' ? 'Peşinat' : 'Taksit' }} · {{ methodLabels[p.paymentMethod] }}@if (p.note) { · {{ p.note }} }</span>
                        <b>{{ money(p.amount) }}</b>
                      </li>
                    }
                  </ul>
                </details>
              }

              @if (plan.status === 'open') {
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-2">
                  <label class="block">
                    <span class="text-[11px] font-bold text-slate-500">Tahsilat tutarı (₺)</span>
                    <input class="odv-input mt-1 w-32" type="number" min="0.01" step="0.01" [max]="plan.remainingAmount"
                           [ngModel]="payAmount(plan)" (ngModelChange)="setPayAmount(plan.id, $event)" />
                  </label>
                  <label class="block">
                    <span class="text-[11px] font-bold text-slate-500">Yöntem</span>
                    <select class="odv-input mt-1" [ngModel]="payMethod()" (ngModelChange)="payMethod.set($event)">
                      @for (m of methodsFor(plan); track m) { <option [value]="m">{{ methodLabels[m] }}</option> }
                    </select>
                  </label>
                  <label class="block flex-1 min-w-[140px]">
                    <span class="text-[11px] font-bold text-slate-500">Not</span>
                    <input class="odv-input mt-1 w-full" type="text" maxlength="500" [ngModel]="payNote()" (ngModelChange)="payNote.set($event)" />
                  </label>
                  <button type="button" class="odv-btn-primary" [disabled]="busy()" (click)="pay(plan)">
                    <mat-icon class="icon-size-4">check</mat-icon>
                    <span>Tahsil Et</span>
                  </button>
                  <div class="w-full flex flex-wrap gap-1.5 text-[11px]">
                    @if (plan.overdueAmount > 0) {
                      <button type="button" class="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold cursor-pointer border-none" (click)="setPayAmount(plan.id, plan.overdueAmount)">
                        Geciken: {{ money(plan.overdueAmount) }}
                      </button>
                    }
                    @if (plan.nextDueAmount > 0) {
                      <button type="button" class="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold cursor-pointer border-none" (click)="setPayAmount(plan.id, plan.nextDueAmount)">
                        Sıradaki taksit: {{ money(plan.nextDueAmount) }}
                      </button>
                    }
                    <button type="button" class="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold cursor-pointer border-none" (click)="setPayAmount(plan.id, plan.remainingAmount)">
                      Tamamı: {{ money(plan.remainingAmount) }}
                    </button>
                    @if (permissions.isAdmin()) {
                      <button type="button" class="ml-auto px-2 py-1 rounded-lg text-rose-600 font-bold cursor-pointer border-none bg-transparent" [disabled]="busy()" (click)="cancel(plan)">
                        Planı iptal et
                      </button>
                    }
                  </div>
                </div>
              } @else if (plan.status === 'cancelled') {
                <p class="m-0 text-[11px] text-slate-500">İptal: {{ dateTime(plan.cancelledAt) }}@if (plan.cancelReason) { · {{ plan.cancelReason }} }</p>
              }
            </section>
          }
        </div>
      </div>
    }

    <app-installment-sale-dialog [open]="saleOpen()" (closed)="saleOpen.set(false)" (completed)="onSold($event)" />
  `,
})
export class AdminReceivables {
  private readonly api = inject(ReceivablesApi);
  private readonly alert = inject(AlertService);
  protected readonly permissions = inject(PermissionService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly day = formatDay;
  protected readonly methodLabels = RECEIVABLE_PAYMENT_LABELS;
  protected readonly methods: ReceivablePaymentMethod[] = ['cash', 'card', 'transfer', 'wallet'];

  /** Cüzdana bağlı borç zaten cüzdanda (-) görünür; e-cüzdandan tahsil etmek parayı iki kez sayar. */
  protected methodsFor(plan: Receivable): ReceivablePaymentMethod[] {
    return plan.walletLinked ? this.methods.filter((m) => m !== 'wallet') : this.methods;
  }
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'debtors', label: 'Borçlu Üyeler' },
    { id: 'overdue', label: 'Geciken Taksitler' },
    { id: 'plans', label: 'Tüm Planlar' },
  ];

  protected readonly tab = signal<Tab>('debtors');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | ReceivableStatus>('all');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly saleOpen = signal(false);

  private readonly plans = signal<Receivable[]>([]);
  private readonly debtors = signal<DebtorRow[]>([]);
  private readonly overdue = signal<OverdueInstallmentRow[]>([]);

  /** Panelde gösterilen: bir üyenin açık planları ya da tek bir plan. */
  private readonly panel = signal<{ userId?: string; planId?: string } | null>(null);
  private readonly payAmounts = signal<Record<string, number>>({});
  protected readonly payMethod = signal<ReceivablePaymentMethod>('cash');
  protected readonly payNote = signal('');

  private readonly matches = (text: string) => {
    const q = this.search().trim().toLocaleLowerCase('tr');
    return !q || text.toLocaleLowerCase('tr').includes(q);
  };

  protected readonly debtorRows = computed(() =>
    this.debtors().filter((r) => this.matches(`${r.memberName} ${r.memberNumber ?? ''} ${r.memberPhone ?? ''}`)),
  );
  protected readonly overdueRows = computed(() =>
    this.overdue().filter((r) => this.matches(`${r.memberName} ${r.memberPhone ?? ''} ${r.packageName}`)),
  );
  protected readonly planRows = computed(() =>
    this.plans().filter(
      (p) =>
        (this.statusFilter() === 'all' || p.status === this.statusFilter()) &&
        this.matches(`${p.memberName} ${p.memberNumber ?? ''} ${p.memberPhone ?? ''} ${p.packageName}`),
    ),
  );

  protected readonly kpi = computed(() => {
    const debtors = this.debtors();
    const today = gymToday();
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 7);
    const horizon = limit.toISOString().slice(0, 10);
    let dueSoonKurus = 0;
    let dueSoonCount = 0;
    for (const plan of this.plans()) {
      if (plan.status !== 'open') continue;
      for (const item of plan.installments) {
        if (item.remainingAmount > 0 && item.dueDate >= today && item.dueDate <= horizon) {
          dueSoonKurus += toKurus(item.remainingAmount);
          dueSoonCount += 1;
        }
      }
    }
    return {
      totalDebt: toTl(debtors.reduce((s, r) => s + toKurus(r.totalDebt), 0)),
      overdueAmount: toTl(debtors.reduce((s, r) => s + toKurus(r.overdueAmount), 0)),
      debtorCount: debtors.length,
      openPlans: debtors.reduce((s, r) => s + r.openPlans, 0),
      lateMembers: debtors.filter((r) => r.overdueAmount > 0).length,
      maxDaysLate: debtors.reduce((m, r) => Math.max(m, r.maxDaysLate), 0),
      dueSoonAmount: toTl(dueSoonKurus),
      dueSoonCount,
    };
  });

  protected readonly panelPlans = computed(() => {
    const panel = this.panel();
    if (!panel) return [];
    if (panel.planId) return this.plans().filter((p) => p.id === panel.planId);
    return this.plans()
      .filter((p) => p.userId === panel.userId && p.status === 'open')
      .sort((a, b) => (a.nextDueDate ?? '').localeCompare(b.nextDueDate ?? ''));
  });
  protected readonly panelDebt = computed(() =>
    toTl(this.panelPlans().reduce((s, p) => s + (p.status === 'open' ? toKurus(p.remainingAmount) : 0), 0)),
  );

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [plans, debtors, overdue] = await Promise.all([
        firstValueFrom(this.api.list()),
        firstValueFrom(this.api.debtors()),
        firstValueFrom(this.api.overdue()),
      ]);
      this.plans.set(plans);
      this.debtors.set(debtors);
      this.overdue.set(overdue);
    } catch (err) {
      this.alert.toastError(receivableErrorMessage(err, 'Borç listesi yüklenemedi.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openMember(userId: string): void {
    this.resetPayForm();
    this.panel.set({ userId });
  }

  protected openPlan(planId: string): void {
    this.resetPayForm();
    this.panel.set({ planId });
  }

  protected closePanel(): void {
    this.panel.set(null);
  }

  /** Varsayılan tahsilat: geciken tutar, yoksa sıradaki taksit. */
  protected payAmount(plan: Receivable): number {
    return this.payAmounts()[plan.id] ?? (plan.overdueAmount > 0 ? plan.overdueAmount : plan.nextDueAmount);
  }

  protected setPayAmount(planId: string, value: unknown): void {
    this.payAmounts.update((current) => ({ ...current, [planId]: Number(value) || 0 }));
  }

  protected async pay(plan: Receivable): Promise<void> {
    const amount = toTl(toKurus(this.payAmount(plan)));
    if (amount <= 0) {
      this.alert.toastWarning('Geçerli bir tahsilat tutarı girin.');
      return;
    }
    if (toKurus(amount) > toKurus(plan.remainingAmount)) {
      this.alert.toastWarning(`Tahsilat kalan borçtan (${this.money(plan.remainingAmount)}) fazla olamaz.`);
      return;
    }
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.pay(plan.id, { amount, paymentMethod: this.payMethod(), note: this.payNote().trim() || undefined }),
      );
      // Cüzdana bağlı planlarda MainApi tahsilatı cüzdana da yazar; panel ayrıca cüzdan hareketi yapmaz.
      this.alert.toastSuccess(
        saved.status === 'paid'
          ? `${this.money(amount)} tahsil edildi, plan kapandı. 🎉`
          : `${this.money(amount)} tahsil edildi. Kalan: ${this.money(saved.remainingAmount)}`,
      );
      this.resetPayForm();
      await this.reload();
    } catch (err) {
      this.alert.toastError(receivableErrorMessage(err, 'Tahsilat kaydedilemedi.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(plan: Receivable): Promise<void> {
    const ok = await this.alert.confirm({
      title: 'Taksit planı iptal edilsin mi?',
      message: `${plan.memberName} · ${plan.packageName}<br>Kalan ${this.money(plan.remainingAmount)} borç takipten çıkar. Alınmış ödemeler iade edilmez, üyelik süresi değişmez.`,
      icon: 'warning',
      confirmText: 'İptal et',
      isDestructive: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      // İptalde kalan borcu cüzdandan MainApi siler (cüzdana bağlı planlar).
      await firstValueFrom(this.api.cancel(plan.id));
      this.alert.toastSuccess('Plan iptal edildi.');
      await this.reload();
    } catch (err) {
      this.alert.toastError(receivableErrorMessage(err, 'Plan iptal edilemedi.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async onSold(plan: Receivable): Promise<void> {
    this.saleOpen.set(false);
    this.alert.toastSuccess(`${plan.memberName} için ${plan.installmentCount} taksitli satış kaydedildi.`);
    await this.reload();
  }

  protected lateClass(days: number): string {
    if (days > 30) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
    if (days > 7) return 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300';
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
  }

  protected statusText(plan: Receivable): string {
    return plan.status === 'open' && plan.overdueCount > 0 ? 'Gecikmede' : STATUS_LABEL[plan.status];
  }

  protected statusClass(plan: Receivable): string {
    if (plan.status === 'paid') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    if (plan.status === 'cancelled') return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    return plan.overdueCount > 0 ? this.lateClass(plan.maxDaysLate) : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300';
  }

  private resetPayForm(): void {
    this.payAmounts.set({});
    this.payMethod.set('cash');
    this.payNote.set('');
  }
}
