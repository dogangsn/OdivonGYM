import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { MemberDebt, MobileApi } from '../../core/api/mobile.api';
import { OnlinePaymentService } from '../../core/services/online-payment.service';
import { formatDate, formatMoney } from '../../shared/ui/ui-utils';

/** Üyenin açık taksit planları; kalan borç kartla (iyzico, 3D Secure) ödenebilir. */
@Component({
  selector: 'app-member-debts',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open().length) {
      <section class="odv-card p-5 mb-6 space-y-3">
        <div class="flex items-center gap-2">
          <mat-icon class="icon-size-5 text-rose-500">receipt_long</mat-icon>
          <h3 class="m-0 text-sm font-black text-slate-900 dark:text-white">Borçlarım</h3>
        </div>
        @if (error()) {
          <p class="m-0 text-xs text-rose-600">{{ error() }}</p>
        }
        @for (d of open(); track d.id) {
          <div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <p class="m-0 text-sm font-bold text-slate-900 dark:text-white">{{ d.packageName }}</p>
              <p class="m-0 text-xs text-slate-500">
                Kalan: <b>{{ money(d.remainingAmount) }}</b>
                @if (d.overdueAmount > 0) {
                  · <span class="text-rose-600 font-bold">Gecikmiş {{ money(d.overdueAmount) }}</span>
                } @else if (d.nextDueDate) {
                  · Sonraki taksit {{ date(d.nextDueDate) }} ({{ money(d.nextDueAmount) }})
                }
              </p>
            </div>
            @if (cardAvailable()) {
            <button type="button"
                    class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 border-none cursor-pointer disabled:opacity-60"
                    [disabled]="paying() !== null"
                    (click)="pay(d)">
              <mat-icon class="icon-size-4">credit_card</mat-icon>
              {{ paying() === d.id ? 'Ödeme sayfası açılıyor…' : 'Kartla öde' }}
            </button>
            }
          </div>
        }
        <p class="m-0 text-[11px] text-slate-400">
          @if (cardAvailable()) {
            Kalan borcun tamamı ödenir; kart bilgileri iyzico'nun güvenli sayfasında girilir.
          } @else {
            Ödemeyi resepsiyonda yapabilirsiniz.
          }
        </p>
      </section>
    }
  `,
})
export class MemberDebts {
  private readonly api = inject(MobileApi);
  private readonly payments = inject(OnlinePaymentService);

  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  private readonly debts = signal<MemberDebt[]>([]);
  protected readonly open = computed(() => this.debts().filter((d) => d.status === 'open' && d.remainingAmount > 0));
  protected readonly paying = signal<string | null>(null);
  protected readonly cardAvailable = this.payments.cardAvailable;
  protected readonly error = signal('');

  constructor() {
    // Personel hesapları bu uca erişemez; hata olursa kart hiç görünmez.
    firstValueFrom(this.api.debts()).then((list) => this.debts.set(list), () => this.debts.set([]));
    void this.payments.loadCardAvailability();
  }

  protected async pay(debt: MemberDebt): Promise<void> {
    this.paying.set(debt.id);
    this.error.set('');
    try {
      window.location.assign(await this.payments.startCardPayment({ purpose: 'receivable', receivableId: debt.id }));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Kartla ödeme başlatılamadı.');
      this.paying.set(null);
    }
  }
}
