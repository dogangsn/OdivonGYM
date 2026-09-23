import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatMoney, formatDateTime, sortDesc } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { ShopSale } from '../../core/models/shop-product.model';

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kredi Kartı',
  transfer: 'Havale/EFT',
  wallet: 'E-Cüzdan',
};

const PAYMENT_ICON: Record<string, string> = {
  cash: 'payments',
  card: 'credit_card',
  transfer: 'account_balance',
  wallet: 'wallet',
};

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-reports.html',
  styleUrl: './admin-reports.scss',
})
export class AdminReports {
  private readonly shopService = inject(AdminShopService);
  private readonly alertService = inject(AlertService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly paymentLabel = PAYMENT_LABEL;
  protected readonly paymentIcon = PAYMENT_ICON;

  protected readonly filterPayment = signal<string>('all');
  protected readonly searchQuery = signal<string>('');

  // Data
  private readonly salesData = toSignal(this.shopService.watchSales(), { initialValue: null });

  protected readonly allSales = computed(() => {
    const list = this.salesData() ?? [];
    return sortDesc(list, (s) => s.saleDate);
  });

  protected readonly completedSales = computed(() =>
    this.allSales().filter((s) => s.status === 'completed'),
  );

  protected readonly totalRevenue = computed(() =>
    this.completedSales().reduce((sum, s) => sum + s.totalAmount, 0),
  );

  protected readonly totalTransactionCount = computed(() => this.completedSales().length);

  protected readonly averageTicket = computed(() => {
    const count = this.totalTransactionCount();
    if (count === 0) return 0;
    return this.totalRevenue() / count;
  });

  protected readonly refundedCount = computed(
    () => this.allSales().filter((s) => s.status === 'refunded').length,
  );

  // Payment Breakdown
  protected readonly paymentStats = computed(() => {
    const sales = this.completedSales();
    const stats: Record<string, { count: number; total: number }> = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      wallet: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
    };

    for (const s of sales) {
      const method = s.paymentMethod || 'cash';
      if (!stats[method]) stats[method] = { count: 0, total: 0 };
      stats[method].count += 1;
      stats[method].total += s.totalAmount;
    }

    return stats;
  });

  // Filtered Sales Table
  protected readonly filteredSales = computed(() => {
    const list = this.allSales();
    const pMethod = this.filterPayment();
    const q = this.searchQuery().trim().toLowerCase();

    return list.filter((s) => {
      const matchPayment = pMethod === 'all' || s.paymentMethod === pMethod;
      const matchQ =
        !q ||
        s.productName?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q);
      return matchPayment && matchQ;
    });
  });

  async refundSale(sale: ShopSale): Promise<void> {
    const confirmed = await this.alertService.actionConfirm(
      'Satış İptali & İade',
      `<strong>${sale.productName}</strong> (₺${this.money(sale.totalAmount)}) için iade işlemi yapılarak stok geri yüklenecektir. Onaylıyor musunuz?`,
      'Evet, İade Et',
      'warning',
      true,
    );
    if (!confirmed) return;

    try {
      await this.shopService.refundSale(sale);
      this.alertService.toastSuccess('İade işlemi başarıyla tamamlandı, stok güncellendi.');
    } catch {
      this.alertService.toastError('İade işlemi sırasında hata oluştu.');
    }
  }
}
