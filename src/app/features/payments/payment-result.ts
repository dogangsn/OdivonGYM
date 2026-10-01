import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { MemberPaymentSession, MobileApi } from '../../core/api/mobile.api';
import { MemberAccountService } from '../../core/services/member-account.service';
import { formatMoney } from '../../shared/ui/ui-utils';

type View = 'loading' | 'succeeded' | 'failed' | 'pending' | 'error';

const TITLES: Record<MemberPaymentSession['source'], string> = {
  gym_member_package: 'Paket ödemesi',
  gym_wallet_topup: 'Bakiye yükleme',
  gym_receivable: 'Borç ödemesi',
};

/**
 * iyzico ödeme sayfasından dönüş. Sonucu adres çubuğundan değil sunucudan okur; ödeme hâlâ
 * bekliyorsa iyzico'ya bir kez daha sorar (sunucu doğrular ve başarılıysa işler).
 */
@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div class="w-full max-w-md odv-card p-6 text-center space-y-4">
        @switch (view()) {
          @case ('loading') {
            <mat-icon class="icon-size-10 text-indigo-500 animate-pulse">hourglass_top</mat-icon>
            <p class="m-0 text-sm font-bold text-slate-700 dark:text-slate-200">Ödeme sonucu kontrol ediliyor…</p>
          }
          @case ('succeeded') {
            <span class="mx-auto w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <mat-icon class="icon-size-7">check_circle</mat-icon>
            </span>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Ödeme başarılı</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">{{ summary() }}</p>
          }
          @case ('pending') {
            <mat-icon class="icon-size-10 text-amber-500">schedule</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Ödeme onay bekliyor</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              Bankanızdan veya iyzico'dan sonuç henüz gelmedi. Biraz sonra tekrar kontrol edebilirsiniz; ödeme onaylanınca
              otomatik işlenir.
            </p>
            <button type="button" class="odv-btn-soft" (click)="check(true)">Tekrar kontrol et</button>
          }
          @case ('failed') {
            <span class="mx-auto w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
              <mat-icon class="icon-size-7">cancel</mat-icon>
            </span>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Ödeme alınamadı</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">Kartınızdan çekim yapılmadı. Tekrar deneyebilir ya da resepsiyona başvurabilirsiniz.</p>
          }
          @default {
            <mat-icon class="icon-size-10 text-rose-500">error_outline</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Sonuç alınamadı</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              Ödeme kaydı bulunamadı veya doğrulanamadı. Kartınızdan çekim yapıldıysa ödeme kısa süre içinde işlenir; aksi
              halde resepsiyona başvurun.
            </p>
            @if (sessionId) {
              <button type="button" class="odv-btn-soft" (click)="check(true)">Tekrar kontrol et</button>
            }
          }
        }
        <div class="flex flex-wrap justify-center gap-2 pt-2">
          <a routerLink="/wallet" class="odv-btn-soft">E-Cüzdan</a>
          <a routerLink="/packages" class="odv-btn-soft">Paketler</a>
          <a routerLink="/dashboard" class="odv-btn-primary">Ana sayfa</a>
        </div>
      </div>
    </div>
  `,
})
export class PaymentResultPage {
  private readonly api = inject(MobileApi);
  private readonly account = inject(MemberAccountService);
  private readonly route = inject(ActivatedRoute);

  protected readonly sessionId = this.route.snapshot.queryParamMap.get('paymentSession');
  protected readonly view = signal<View>('loading');
  protected readonly summary = signal('');

  constructor() {
    void this.check(false);
  }

  /** Reads the session; while it is still open asks iyzico again a few times. */
  protected async check(force: boolean): Promise<void> {
    if (!this.sessionId) {
      this.view.set('error');
      return;
    }
    this.view.set('loading');
    try {
      let session = await firstValueFrom(this.api.payment(this.sessionId));
      for (let attempt = 0; this.isOpen(session) && attempt < (force ? 1 : 3); attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          session = await firstValueFrom(this.api.reconcilePayment(this.sessionId));
        } catch {
          break; // iyzico has no result for this page yet (not paid or still open)
        }
      }
      this.show(session);
    } catch {
      this.view.set('error');
    }
  }

  private isOpen(session: MemberPaymentSession) {
    return session.status === 'pending' || session.status === 'abandoned' || session.status === 'initializing';
  }

  private show(session: MemberPaymentSession) {
    if (session.status === 'succeeded') {
      this.summary.set(`${TITLES[session.source]}: ${formatMoney(session.amountKurus / 100)} kartınızdan çekildi ve hesabınıza işlendi.`);
      this.view.set('succeeded');
      void this.account.reload();
    } else if (session.status === 'failed') {
      this.view.set('failed');
    } else {
      this.view.set('pending');
    }
  }
}
