import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { WalletTransaction } from '../../../core/models/wallet-transaction.model';
import { AlertService } from '../../../core/services/alert.service';
import { CheckoutModal } from '../../../shared/components/checkout-modal/checkout-modal';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { formatDateTime, formatMoney, sortDesc } from '../../../shared/ui/ui-utils';
import { WalletService } from '../wallet.service';

const TYPE_LABEL: Record<WalletTransaction['type'], string> = {
  deposit: 'Bakiye Yükleme',
  debit: 'Harcama',
  refund: 'İade',
};

const STATUS_LABEL: Record<WalletTransaction['status'], string> = {
  completed: 'Tamamlandı',
  pending: 'Beklemede',
  failed: 'Başarısız',
  cancelled: 'İptal',
};

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader, CheckoutModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(WalletService);
  private readonly alert = inject(AlertService);

  protected readonly typeLabel = TYPE_LABEL;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  // Top-Up Modal State
  readonly isTopUpOpen = signal<boolean>(false);
  readonly topUpAmount = signal<number>(500);
  readonly customAmount = signal<number | null>(null);

  readonly quickAmounts = [250, 500, 1000, 2500];

  private readonly data = toSignal(this.service.watchTransactions(), { initialValue: null });
  protected readonly transactions = computed(() => {
    const list = this.data();
    return list && sortDesc(list, (t) => t.createdAt);
  });

  protected readonly balanceLabel = computed(() => {
    const balance = this.auth.profile()?.walletBalance ?? 0;
    return balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  protected isCredit(t: WalletTransaction): boolean {
    return t.type !== 'debit';
  }

  openTopUp(amount?: number): void {
    if (amount) {
      this.topUpAmount.set(amount);
      this.customAmount.set(null);
    }
    this.isTopUpOpen.set(true);
  }

  selectQuickAmount(amt: number): void {
    this.topUpAmount.set(amt);
    this.customAmount.set(null);
  }

  onCustomAmountChange(val: string): void {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      this.customAmount.set(num);
      this.topUpAmount.set(num);
    }
  }

  onTopUpSuccess(result: any): void {
    this.alert.success(result.message || 'Bakiye yükleme işlemi başarıyla tamamlandı!');
  }
}
