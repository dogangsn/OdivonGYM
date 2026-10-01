import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { CheckoutBuyer, PaymentsApi } from '../../../core/api/payments.api';
import { AuthService } from '../../../core/auth/auth.service';
import { SaasBillingCycle, SaasPlanId } from '../../../core/models/saas-plan.model';
import { toAppError } from '../../models/app-error.model';

/**
 * Odivon aboneliğinin kartla ödemesi (salon sahibi). Fatura bilgileri alınır, sunucu fiyatlı
 * sipariş oluşturulur ve iyzico ödeme sayfası açılır. Abonelik yalnızca doğrulanmış ödemeden
 * sonra sunucuda açılır; panel hiçbir planı kendisi etkinleştirmez.
 */
@Component({
  selector: 'app-saas-checkout',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.profile()?.role !== 'owner') {
      <p class="m-0 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
        Abonelik ödemesini yalnızca salon sahibi yapabilir.
      </p>
    } @else {
      <div class="space-y-3 text-left">
        <div class="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <label class="space-y-1">T.C. Kimlik No / VKN
            <input class="odv-input" inputmode="numeric" maxlength="11" [ngModel]="identity()" (ngModelChange)="identity.set($event)" />
          </label>
          <label class="space-y-1">Telefon
            <input class="odv-input" type="tel" [ngModel]="phone()" (ngModelChange)="phone.set($event)" />
          </label>
          <label class="space-y-1 col-span-2">E-posta
            <input class="odv-input" type="email" [ngModel]="email()" (ngModelChange)="email.set($event)" />
          </label>
          <label class="space-y-1 col-span-2">Fatura adresi
            <input class="odv-input" [ngModel]="address()" (ngModelChange)="address.set($event)" />
          </label>
          <label class="space-y-1">Şehir
            <input class="odv-input" [ngModel]="city()" (ngModelChange)="city.set($event)" />
          </label>
        </div>
        @if (error()) {
          <div role="alert" class="rounded-xl bg-rose-50 text-rose-700 p-3 text-xs font-semibold">{{ error() }}</div>
        }
        <button type="button" class="odv-btn-primary w-full !py-3 font-bold flex items-center justify-center gap-2"
                [disabled]="busy()" (click)="pay()">
          <mat-icon class="icon-size-4.5">credit_card</mat-icon>
          {{ busy() ? 'Ödeme sayfası açılıyor…' : 'Kartla Öde (iyzico)' }}
        </button>
        <p class="m-0 text-[11px] text-slate-400 text-center">
          Kart bilgileri iyzico'nun güvenli sayfasında (3D Secure) girilir. Aboneliğiniz ödeme onaylanınca açılır.
        </p>
      </div>
    }
  `,
})
export class SaasCheckout {
  protected readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentsApi);

  readonly planId = input.required<SaasPlanId>();
  readonly cycle = input.required<SaasBillingCycle>();

  protected readonly identity = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly address = signal('');
  protected readonly city = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (!profile) return;
      if (!this.email()) this.email.set(profile.email || '');
      if (!this.phone()) this.phone.set(profile.phone || '');
      if (!this.identity()) this.identity.set(profile.nationalId || '');
    });
  }

  protected async pay(): Promise<void> {
    const parts = (this.auth.profile()?.displayName || '').trim().split(/\s+/);
    const buyer: CheckoutBuyer = {
      name: parts.slice(0, -1).join(' ') || parts[0] || '',
      surname: parts.length > 1 ? parts.at(-1)! : parts[0] || '',
      identityNumber: this.identity().trim(),
      email: this.email().trim(),
      gsmNumber: this.phone().trim(),
      address: this.address().trim(),
      city: this.city().trim(),
      country: 'Turkey',
    };
    if (!/^\d{11}$/.test(buyer.identityNumber) || !buyer.email.includes('@') || !buyer.gsmNumber || !buyer.address || !buyer.city) {
      this.error.set('Kimlik no, e-posta, telefon, adres ve şehir alanlarını doldurun.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const order = await firstValueFrom(this.payments.createSaasOrder(this.planId(), this.cycle()));
      const session = await firstValueFrom(this.payments.checkoutSaas(order.id, buyer));
      if (!session.paymentPageUrl) throw new Error('iyzico ödeme sayfası oluşturulamadı.');
      window.location.assign(session.paymentPageUrl);
    } catch (err) {
      this.error.set(toAppError(err).message || 'Ödeme başlatılamadı.');
      this.busy.set(false);
    }
  }
}
