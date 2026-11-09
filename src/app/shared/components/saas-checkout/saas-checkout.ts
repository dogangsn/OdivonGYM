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
 * sipariş oluşturulur ve ödeme sağlayıcısının (PayTR) güvenli sayfası açılır. Abonelik yalnızca doğrulanmış ödemeden
 * sonra sunucuda açılır; panel hiçbir planı kendisi etkinleştirmez.
 */
@Component({
  selector: 'app-saas-checkout',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.profile()?.role !== 'owner') {
      <div class="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 p-4">
        <mat-icon class="icon-size-5 shrink-0 text-amber-600 dark:text-amber-400">lock_person</mat-icon>
        <p class="m-0 text-xs font-semibold text-amber-800 dark:text-amber-300">
          Abonelik ödemesini yalnızca salon sahibi yapabilir.
        </p>
      </div>
    } @else {
      <div class="space-y-4 text-left">
        <div class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <mat-icon class="icon-size-4.5">receipt_long</mat-icon>
            </div>
            <div>
              <h4 class="m-0 text-sm font-black text-slate-900 dark:text-white tracking-tight">Fatura bilgileri</h4>
              <p class="m-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Faturanız bu bilgilerle düzenlenir.</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 p-4">
            @for (f of fields; track f.key) {
              <label class="block" [class.col-span-2]="f.wide">
                <span class="block mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">{{ f.label }}</span>
                <span class="relative block">
                  <mat-icon class="absolute left-3 top-1/2 -translate-y-1/2 icon-size-4 text-slate-400 pointer-events-none">{{ f.icon }}</mat-icon>
                  <input
                    class="odv-input !pl-9"
                    [type]="f.type"
                    [attr.inputmode]="f.inputmode"
                    [attr.maxlength]="f.maxlength"
                    [attr.autocomplete]="f.autocomplete"
                    [placeholder]="f.placeholder"
                    [ngModel]="f.value()"
                    (ngModelChange)="f.value.set($event)"
                  />
                </span>
              </label>
            }
          </div>
        </div>

        @if (error()) {
          <div role="alert" class="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <mat-icon class="icon-size-4 shrink-0">error</mat-icon>
            <span>{{ error() }}</span>
          </div>
        }

        <button type="button" class="odv-btn-primary w-full justify-center !py-3.5 !text-sm hover:!scale-100"
                [disabled]="busy()" (click)="pay()">
          @if (busy()) {
            <span class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
            <span>Ödeme sayfası açılıyor…</span>
          } @else {
            <mat-icon class="icon-size-4.5">lock</mat-icon>
            <span>{{ amount() ? amount() + ' Güvenle Öde' : 'Güvenle Öde' }}</span>
          }
        </button>

        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3.5 py-3 space-y-2.5">
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span class="inline-flex items-center gap-1"><mat-icon class="icon-size-3.5 text-emerald-500">verified_user</mat-icon>3D Secure</span>
            <span class="inline-flex items-center gap-1"><mat-icon class="icon-size-3.5 text-emerald-500">https</mat-icon>256-bit SSL</span>
            <span class="inline-flex items-center gap-1"><mat-icon class="icon-size-3.5 text-emerald-500">credit_card_off</mat-icon>Kart bilgisi saklanmaz</span>
          </div>
          <div class="flex items-center justify-center gap-1.5">
            @for (brand of cardBrands; track brand) {
              <span class="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black tracking-wide text-slate-600 dark:text-slate-300">{{ brand }}</span>
            }
          </div>
          <p class="m-0 text-[11px] leading-relaxed text-slate-400 text-center">
            Kart bilgileriniz güvenli ödeme sayfasında girilir. Aboneliğiniz ödeme onaylanınca açılır.
          </p>
        </div>
      </div>
    }
  `,
})
export class SaasCheckout {
  protected readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentsApi);

  readonly planId = input.required<SaasPlanId>();
  readonly cycle = input.required<SaasBillingCycle>();
  /** Butonda gösterilen tutar, örn. "2.990 ₺". */
  readonly amount = input<string>('');

  protected readonly identity = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly address = signal('');
  protected readonly city = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly cardBrands = ['VISA', 'Mastercard', 'TROY'];
  protected readonly fields = [
    { key: 'identity', label: 'T.C. Kimlik No / VKN', icon: 'badge', type: 'text', inputmode: 'numeric', maxlength: 11, autocomplete: 'off', placeholder: '11 haneli', wide: false, value: this.identity },
    { key: 'phone', label: 'Telefon', icon: 'call', type: 'tel', inputmode: 'tel', maxlength: null, autocomplete: 'tel', placeholder: '05xx xxx xx xx', wide: false, value: this.phone },
    { key: 'email', label: 'E-posta', icon: 'mail', type: 'email', inputmode: 'email', maxlength: null, autocomplete: 'email', placeholder: 'ornek@salon.com', wide: true, value: this.email },
    { key: 'address', label: 'Fatura adresi', icon: 'home', type: 'text', inputmode: null, maxlength: null, autocomplete: 'street-address', placeholder: 'Mahalle, cadde, no', wide: true, value: this.address },
    { key: 'city', label: 'Şehir', icon: 'location_city', type: 'text', inputmode: null, maxlength: null, autocomplete: 'address-level1', placeholder: 'İstanbul', wide: true, value: this.city },
  ] as const;

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
      if (!session.paymentPageUrl) throw new Error('Ödeme sayfası oluşturulamadı.');
      window.location.assign(session.paymentPageUrl);
    } catch (err) {
      this.error.set(toAppError(err).message || 'Ödeme başlatılamadı.');
      this.busy.set(false);
    }
  }
}
