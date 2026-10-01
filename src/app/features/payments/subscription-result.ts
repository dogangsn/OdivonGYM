import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { PaymentsApi, PaymentSession } from '../../core/api/payments.api';
import { formatMoney } from '../../shared/ui/ui-utils';

type View = 'loading' | 'succeeded' | 'test' | 'failed' | 'pending' | 'error';

/**
 * Odivon abonelik ödemesinden dönüş. Abonelik sayfası süresi dolan salonda kapalı olduğu için
 * bu sayfa ayrı; sonuç sunucudan okunur, devam edince profil (erişim) yeniden yüklenir.
 */
@Component({
  selector: 'app-subscription-result',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div class="w-full max-w-md odv-card p-6 text-center space-y-4">
        @switch (view()) {
          @case ('loading') {
            <mat-icon class="icon-size-10 text-indigo-500 animate-pulse">hourglass_top</mat-icon>
            <p class="m-0 text-sm font-bold">Ödeme sonucu kontrol ediliyor…</p>
          }
          @case ('succeeded') {
            <mat-icon class="icon-size-10 text-emerald-600">verified</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Aboneliğiniz aktif</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">{{ amount() }} ödemeniz alındı. Makbuzunuzu Abonelik ekranında görebilirsiniz.</p>
          }
          @case ('test') {
            <mat-icon class="icon-size-10 text-amber-500">science</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Test ödemesi başarılı</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">Test ortamında yapılan ödeme aboneliği değiştirmez.</p>
          }
          @case ('pending') {
            <mat-icon class="icon-size-10 text-amber-500">schedule</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Ödeme onay bekliyor</p>
            <button type="button" class="odv-btn-soft" (click)="check()">Tekrar kontrol et</button>
          }
          @case ('failed') {
            <mat-icon class="icon-size-10 text-rose-600">cancel</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Ödeme alınamadı</p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">Kartınızdan çekim yapılmadı. Tekrar deneyebilirsiniz.</p>
          }
          @default {
            <mat-icon class="icon-size-10 text-rose-500">error_outline</mat-icon>
            <p class="m-0 text-lg font-black text-slate-900 dark:text-white">Sonuç alınamadı</p>
            <button type="button" class="odv-btn-soft" (click)="check()">Tekrar kontrol et</button>
          }
        }
        <button type="button" class="odv-btn-primary w-full" (click)="continue()">Devam et</button>
      </div>
    </div>
  `,
})
export class SubscriptionResultPage {
  private readonly api = inject(PaymentsApi);
  private readonly sessionId = inject(ActivatedRoute).snapshot.queryParamMap.get('paymentSession');

  protected readonly view = signal<View>('loading');
  protected readonly amount = signal('');

  constructor() {
    void this.check();
  }

  protected async check(): Promise<void> {
    if (!this.sessionId) {
      this.view.set('error');
      return;
    }
    this.view.set('loading');
    try {
      let session = await firstValueFrom(this.api.session(this.sessionId));
      if (session.status === 'pending' || session.status === 'abandoned') {
        session = await firstValueFrom(this.api.reconcile(this.sessionId)).catch(() => session);
      }
      this.show(session);
    } catch {
      this.view.set('error');
    }
  }

  private show(session: PaymentSession) {
    this.amount.set(formatMoney(session.amountKurus / 100));
    if (session.status === 'succeeded') this.view.set(session.mode === 'live' ? 'succeeded' : 'test');
    else if (session.status === 'failed') this.view.set('failed');
    else this.view.set('pending');
  }

  /** Tam sayfa yükleme: erişim durumu (profil) sunucudan yeniden okunur. */
  protected continue(): void {
    window.location.assign('/admin/subscription');
  }
}
