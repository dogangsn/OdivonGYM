import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { WalletTransaction } from '../../../core/models/wallet-transaction.model';
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

/**
 * E-Cüzdan — salon içi otomat, market ve ek ders/PT satışlarında kullanılan
 * bakiye. Bakiye ve hareketler admin panelinden (Üye Kayıtları → cüzdan ikonu)
 * yüklenir/düşülür; üye kendi hareketlerini burada görür.
 */
@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(WalletService);

  protected readonly typeLabel = TYPE_LABEL;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

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
}
