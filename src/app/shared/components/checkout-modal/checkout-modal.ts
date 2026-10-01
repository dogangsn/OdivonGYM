import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MemberAccountService } from '../../../core/services/member-account.service';
import {
  OnlinePaymentService,
  PaymentResult,
  PurchasablePackage,
} from '../../../core/services/online-payment.service';
import { formatMoney } from '../../ui/ui-utils';

export type CheckoutMode = 'package' | 'wallet_topup';

/**
 * Üye paket alımı. Gerçek kart ödemesi (sanal POS) bağlı olmadığı için ödeme yalnız e-cüzdan
 * bakiyesinden yapılır; bakiye yüklemesi resepsiyonda yapılır. Kart formu / 3D Secure ekranı yoktur.
 */
@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.scss',
})
export class CheckoutModal {
  private readonly paymentService = inject(OnlinePaymentService);
  protected readonly account = inject(MemberAccountService);

  readonly open = input<boolean>(false);
  readonly mode = input<CheckoutMode>('package');
  readonly selectedPackage = input<PurchasablePackage | null>(null);
  readonly topUpAmount = input<number>(500);

  readonly closed = output<void>();
  readonly paymentSuccess = output<PaymentResult>();

  protected readonly money = formatMoney;
  readonly isProcessing = signal(false);
  readonly step = signal<'form' | 'success'>('form');
  readonly errorMessage = signal<string | null>(null);
  readonly lastResult = signal<PaymentResult | null>(null);

  readonly walletBalance = computed(() => this.account.me()?.walletBalance ?? null);
  readonly price = computed(() => this.selectedPackage()?.price ?? 0);
  readonly remainingAfter = computed(() => (this.walletBalance() ?? 0) - this.price());
  readonly isWalletSufficient = computed(() => (this.walletBalance() ?? 0) >= this.price());

  constructor() {
    // Her açılışta güncel bakiyeyi çek ve ekranı sıfırla.
    effect(() => {
      if (!this.open()) return;
      this.step.set('form');
      this.errorMessage.set(null);
      this.lastResult.set(null);
      void this.account.reload();
    });
  }

  async confirmPurchase(): Promise<void> {
    const pkg = this.selectedPackage();
    if (!pkg || this.isProcessing()) return;
    if (!this.isWalletSufficient()) {
      this.errorMessage.set('E-cüzdan bakiyeniz bu paket için yetersiz. Bakiye yüklemesi için resepsiyona başvurabilirsiniz.');
      return;
    }
    this.isProcessing.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.paymentService.purchasePackage(pkg);
      this.lastResult.set(result);
      this.step.set('success');
      this.paymentSuccess.emit(result);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Paket satın alınamadı.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  closeModal(): void {
    if (this.isProcessing()) return;
    this.closed.emit();
  }
}
