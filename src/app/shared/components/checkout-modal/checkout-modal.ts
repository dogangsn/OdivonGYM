import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { GymPackage } from '../../../core/models/gym-package.model';
import {
  CardBrand,
  OnlinePaymentService,
  PaymentResult,
} from '../../../core/services/online-payment.service';

export type CheckoutMode = 'package' | 'wallet_topup';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.scss',
})
export class CheckoutModal {
  protected readonly auth = inject(AuthService);
  private readonly paymentService = inject(OnlinePaymentService);

  // Inputs
  readonly open = input<boolean>(false);
  readonly mode = input<CheckoutMode>('package');
  readonly selectedPackage = input<GymPackage | null>(null);
  readonly topUpAmount = input<number>(500);

  // Outputs
  readonly closed = output<void>();
  readonly paymentSuccess = output<PaymentResult>();

  // State
  readonly paymentMethod = signal<'card' | 'wallet' | 'transfer'>('card');
  readonly isProcessing = signal<boolean>(false);
  readonly step = signal<'form' | '3ds_simulation' | 'success'>('form');
  readonly errorMessage = signal<string | null>(null);
  readonly lastResult = signal<PaymentResult | null>(null);

  // Form Fields
  readonly cardHolder = signal<string>('');
  readonly cardNumber = signal<string>('');
  readonly expiryMonth = signal<string>('12');
  readonly expiryYear = signal<string>('28');
  readonly cvv = signal<string>('');
  readonly saveCard = signal<boolean>(true);

  // 3D Secure SMS code simulation
  readonly smsCode = signal<string>('784920');
  readonly inputSmsCode = signal<string>('');
  readonly timerSeconds = signal<number>(59);

  // Computed values
  readonly profile = this.auth.profile;
  readonly walletBalance = computed(() => this.profile()?.walletBalance ?? 0);

  readonly totalAmount = computed(() => {
    if (this.mode() === 'package') {
      return this.selectedPackage()?.price ?? 0;
    }
    return this.topUpAmount();
  });

  readonly isWalletSufficient = computed(() => {
    return this.walletBalance() >= this.totalAmount();
  });

  readonly cardBrand = computed<CardBrand>(() => {
    return this.paymentService.detectCardBrand(this.cardNumber());
  });

  readonly formattedCardNumber = computed(() => {
    const raw = this.cardNumber().replace(/\s+/g, '');
    if (!raw) return '•••• •••• •••• ••••';
    let formatted = this.paymentService.formatCardNumber(raw);
    const missing = 19 - formatted.length;
    if (missing > 0) {
      formatted += '•'.repeat(Math.min(missing, 19));
    }
    return formatted;
  });

  // Actions
  onCardNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.paymentService.formatCardNumber(input.value);
    this.cardNumber.set(formatted);
  }

  onCvvInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.cvv.set(input.value.replace(/\D/g, '').slice(0, 4));
  }

  setMethod(method: 'card' | 'wallet' | 'transfer'): void {
    this.errorMessage.set(null);
    this.paymentMethod.set(method);
  }

  async startPayment(): Promise<void> {
    this.errorMessage.set(null);

    // Validations
    if (this.paymentMethod() === 'wallet' && !this.isWalletSufficient()) {
      this.errorMessage.set('Cüzdan bakiyeniz yetersiz. Lütfen kart ile ödeyin veya bakiye yükleyin.');
      return;
    }

    if (this.paymentMethod() === 'card') {
      const cleanNum = this.cardNumber().replace(/\s+/g, '');
      if (cleanNum.length < 15) {
        this.errorMessage.set('Lütfen geçerli 16 haneli bir kart numarası giriniz.');
        return;
      }
      if (!this.cardHolder().trim()) {
        this.errorMessage.set('Lütfen kart üzerindeki ad soyadı giriniz.');
        return;
      }
      if (this.cvv().length < 3) {
        this.errorMessage.set('Lütfen 3 haneli güvenlik kodunu (CVV) giriniz.');
        return;
      }

      // 3D Secure ekranına geç
      this.inputSmsCode.set('');
      this.step.set('3ds_simulation');
      return;
    }

    // Doğrudan cüzdan veya havale ile tamamlama
    await this.executeFinalTransaction();
  }

  async verifySmsAndComplete(): Promise<void> {
    // 3D Secure doğrula
    if (this.inputSmsCode().trim().length < 6) {
      this.errorMessage.set('Lütfen telefonunuza gelen 6 haneli doğrulama kodunu giriniz.');
      return;
    }

    await this.executeFinalTransaction();
  }

  private async executeFinalTransaction(): Promise<void> {
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    try {
      let result: PaymentResult;

      const cardPayload = {
        cardHolder: this.cardHolder(),
        cardNumber: this.cardNumber(),
        expiryMonth: this.expiryMonth(),
        expiryYear: this.expiryYear(),
        cvv: this.cvv(),
      };

      if (this.mode() === 'package') {
        const pkg = this.selectedPackage();
        if (!pkg) throw new Error('Paket seçilmedi.');
        result = await this.paymentService.purchaseGymPackage(
          pkg,
          this.paymentMethod(),
          this.paymentMethod() === 'card' ? cardPayload : undefined,
        );
      } else {
        result = await this.paymentService.topUpWallet(this.topUpAmount(), cardPayload);
      }

      this.lastResult.set(result);
      this.step.set('success');
      this.paymentSuccess.emit(result);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Ödeme gerçekleştirilemedi.');
      if (this.step() === '3ds_simulation') {
        this.step.set('form');
      }
    } finally {
      this.isProcessing.set(false);
    }
  }

  fillQuickSms(): void {
    this.inputSmsCode.set(this.smsCode());
  }

  closeModal(): void {
    if (this.isProcessing()) return;
    this.step.set('form');
    this.errorMessage.set(null);
    this.lastResult.set(null);
    this.closed.emit();
  }
}
