import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ComingSoon } from '../../../shared/components/coming-soon/coming-soon';

const TOP_UP_AMOUNTS = [50, 100, 250, 500];

/**
 * E-Cüzdan — salon içi otomat, market ve ek ders/PT satışlarında kullanılan
 * bakiye. Ödeme entegrasyonu (Stripe/Iyzico) bağlanana kadar "Bakiye Yükle"
 * ve işlem geçmişi placeholder; bakiyenin kendisi (bkz. UserProfile.walletBalance)
 * şimdilik admin panelinden manuel olarak yönetilecek.
 */
@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [PageHeader, ComingSoon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet {
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly amounts = TOP_UP_AMOUNTS;

  protected readonly balanceLabel = computed(() => {
    const balance = this.auth.profile()?.walletBalance ?? 0;
    return balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  requestTopUp(amount: number): void {
    this.snackBar.open(`₺${amount} bakiye yükleme — ödeme entegrasyonu yakında aktif olacak.`, 'Kapat', {
      duration: 3000,
    });
  }
}
