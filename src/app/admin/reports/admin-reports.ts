import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatMoney, formatDateTime, sortDesc, formatDate } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { AdminAccountingService } from '../accounting/admin-accounting.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminAccessControlService } from '../access-control/admin-access-control.service';
import { ShopSale } from '../../core/models/shop-product.model';
import { AccountingEntry } from '../../core/models/accounting-entry.model';

export type ReportTab = 'pnl' | 'memberships' | 'shop' | 'turnstile';
export type DateFilterRange = 'all' | 'today' | 'this_month' | 'last_30_days';

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
  private readonly accountingService = inject(AdminAccountingService);
  private readonly membersService = inject(AdminMembersService);
  private readonly accessService = inject(AdminAccessControlService);
  private readonly alertService = inject(AlertService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly date = formatDate;
  protected readonly paymentLabel = PAYMENT_LABEL;
  protected readonly paymentIcon = PAYMENT_ICON;

  // Active Tab & Filters
  readonly activeTab = signal<ReportTab>('pnl');
  readonly dateRange = signal<DateFilterRange>('this_month');
  readonly filterPayment = signal<string>('all');
  readonly searchQuery = signal<string>('');

  // 1. Data Signals
  private readonly salesData = toSignal(this.shopService.watchSales(), { initialValue: null });
  private readonly accountingData = toSignal(this.accountingService.watchEntries(), { initialValue: null });
  private readonly membersData = toSignal(this.membersService.watchMembers(), { initialValue: null });
  private readonly accessLogsData = toSignal(this.accessService.watchLogs(), { initialValue: null });

  // 2. Filter Helpers
  private isDateInRange(dateMillis: number): boolean {
    const range = this.dateRange();
    if (range === 'all') return true;

    const now = new Date();
    if (range === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return dateMillis >= todayStart;
    }
    if (range === 'this_month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return dateMillis >= monthStart;
    }
    if (range === 'last_30_days') {
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      return dateMillis >= thirtyDaysAgo;
    }
    return true;
  }

  // 3. P&L & Accounting Calculations
  protected readonly filteredEntries = computed(() => {
    const list = this.accountingData() ?? [];
    return list.filter((e) => {
      const entryTime = e.entryDate?.toMillis?.() || e.createdAt?.toMillis?.() || 0;
      return this.isDateInRange(entryTime);
    });
  });

  protected readonly totalIncome = computed(() => {
    return this.filteredEntries()
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  });

  protected readonly totalExpense = computed(() => {
    return this.filteredEntries()
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  });

  protected readonly netProfit = computed(() => {
    return this.totalIncome() - this.totalExpense();
  });

  protected readonly profitMargin = computed(() => {
    const income = this.totalIncome();
    if (income <= 0) return 0;
    return Math.round((this.netProfit() / income) * 100);
  });

  // Income Breakdown by Category
  protected readonly incomeByCategory = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.filteredEntries()) {
      if (e.type === 'income') {
        const cat = e.category || 'Diğer Gelirler';
        map.set(cat, (map.get(cat) || 0) + e.amount);
      }
    }
    return Array.from(map.entries()).map(([category, total]) => ({
      category,
      total,
      percentage: this.totalIncome() > 0 ? Math.round((total / this.totalIncome()) * 100) : 0,
    }));
  });

  // Expense Breakdown by Category
  protected readonly expenseByCategory = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.filteredEntries()) {
      if (e.type === 'expense') {
        const cat = e.category || 'Genel Gider';
        map.set(cat, (map.get(cat) || 0) + e.amount);
      }
    }
    return Array.from(map.entries()).map(([category, total]) => ({
      category,
      total,
      percentage: this.totalExpense() > 0 ? Math.round((total / this.totalExpense()) * 100) : 0,
    }));
  });

  // 4. Membership & Subscription Stats
  protected readonly allMembers = computed(() => this.membersData() ?? []);

  protected readonly activeMemberCount = computed(() => {
    return this.allMembers().filter((m) => m.membershipStatus === 'active').length;
  });

  protected readonly expiredMemberCount = computed(() => {
    return this.allMembers().filter((m) => m.membershipStatus === 'expired').length;
  });

  protected readonly trialMemberCount = computed(() => {
    return this.allMembers().filter((m) => m.membershipStatus === 'trial').length;
  });

  protected readonly packageDistribution = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.allMembers()) {
      const pkg = m.packageLabel || 'Paketsiz / Tanımsız';
      map.set(pkg, (map.get(pkg) || 0) + 1);
    }
    const total = this.allMembers().length || 1;
    return Array.from(map.entries()).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  });

  // 5. Shop & Cafe Stats
  protected readonly allSales = computed(() => {
    const list = this.salesData() ?? [];
    return sortDesc(list, (s) => s.saleDate).filter((s) => {
      const saleTime = s.saleDate?.toMillis?.() || s.createdAt?.toMillis?.() || 0;
      return this.isDateInRange(saleTime);
    });
  });

  protected readonly completedSales = computed(() =>
    this.allSales().filter((s) => s.status === 'completed'),
  );

  protected readonly totalShopRevenue = computed(() =>
    this.completedSales().reduce((sum, s) => sum + s.totalAmount, 0),
  );

  protected readonly totalTransactionCount = computed(() => this.completedSales().length);

  protected readonly averageTicket = computed(() => {
    const count = this.totalTransactionCount();
    if (count === 0) return 0;
    return this.totalShopRevenue() / count;
  });

  protected readonly refundedCount = computed(
    () => this.allSales().filter((s) => s.status === 'refunded').length,
  );

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

  // 6. Turnstile & Peak Hours Analytics
  protected readonly turnstileLogs = computed(() => {
    const list = this.accessLogsData() ?? [];
    return list.filter((log) => {
      const logTime = log.timestamp?.toMillis?.() || 0;
      return this.isDateInRange(logTime);
    });
  });

  protected readonly totalVisits = computed(() => this.turnstileLogs().length);

  protected readonly allowedVisits = computed(() => {
    return this.turnstileLogs().filter((l) => l.status === 'granted').length;
  });

  protected readonly deniedVisits = computed(() => {
    return this.turnstileLogs().filter((l) => l.status !== 'granted').length;
  });

  // Peak Hours Distribution
  protected readonly peakHoursStats = computed(() => {
    const buckets = [
      { label: '06:00 - 09:00 (Erken Sabah)', count: 0 },
      { label: '09:00 - 12:00 (Kuşluk)', count: 0 },
      { label: '12:00 - 15:00 (Öğle Arası)', count: 0 },
      { label: '15:00 - 18:00 (Öğleden Sonra)', count: 0 },
      { label: '18:00 - 21:00 (Pik Akşam)', count: 0 },
      { label: '21:00 - 00:00 (Gece)', count: 0 },
    ];

    for (const log of this.turnstileLogs()) {
      const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
      const hour = date.getHours();
      if (hour >= 6 && hour < 9) buckets[0].count++;
      else if (hour >= 9 && hour < 12) buckets[1].count++;
      else if (hour >= 12 && hour < 15) buckets[2].count++;
      else if (hour >= 15 && hour < 18) buckets[3].count++;
      else if (hour >= 18 && hour < 21) buckets[4].count++;
      else buckets[5].count++;
    }

    const maxCount = Math.max(...buckets.map((b) => b.count), 1);
    return buckets.map((b) => ({
      ...b,
      percentage: Math.round((b.count / maxCount) * 100),
    }));
  });

  // Tab switcher
  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);
  }

  setDateRange(range: DateFilterRange): void {
    this.dateRange.set(range);
  }

  // Export to CSV
  exportToCsv(): void {
    let rows: string[][] = [];
    let filename = 'odivon-rapor.csv';

    if (this.activeTab() === 'pnl') {
      filename = 'odivon-kar-zarar-raporu.csv';
      rows.push(['Tarih', 'Tür', 'Kategori', 'Açıklama', 'Ödeme Yöntemi', 'Tutar (TL)']);
      for (const e of this.filteredEntries()) {
        const d = e.entryDate?.toDate ? e.entryDate.toDate().toLocaleDateString('tr-TR') : '';
        rows.push([
          `"${d}"`,
          `"${e.type === 'income' ? 'Gelir' : 'Gider'}"`,
          `"${e.category}"`,
          `"${e.description || ''}"`,
          `"${e.paymentMethod || ''}"`,
          `${e.amount}`,
        ]);
      }
    } else if (this.activeTab() === 'shop') {
      filename = 'odivon-market-satislari.csv';
      rows.push(['Tarih', 'Ürün Adı', 'Adet', 'Ödeme Yöntemi', 'Durum', 'Tutar (TL)']);
      for (const s of this.filteredSales()) {
        const d = s.saleDate?.toDate ? s.saleDate.toDate().toLocaleString('tr-TR') : '';
        rows.push([
          `"${d}"`,
          `"${s.productName}"`,
          `${s.quantity}`,
          `"${s.paymentMethod}"`,
          `"${s.status}"`,
          `${s.totalAmount}`,
        ]);
      }
    } else if (this.activeTab() === 'memberships') {
      filename = 'odivon-uyelik-dagilimi.csv';
      rows.push(['Paket Adı', 'Üye Sayısı', 'Yüzde']);
      for (const p of this.packageDistribution()) {
        rows.push([`"${p.name}"`, `${p.count}`, `"%${p.percentage}"`]);
      }
    } else {
      filename = 'odivon-turnike-analizi.csv';
      rows.push(['Saat Dilimi', 'Geçiş Sayısı', 'Yoğunluk Oranı']);
      for (const p of this.peakHoursStats()) {
        rows.push([`"${p.label}"`, `${p.count}`, `"%${p.percentage}"`]);
      }
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.alertService.toastSuccess('Rapor başarıyla CSV formatında dışa aktarıldı.');
  }

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
