import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatMoney, formatDateTime } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { AdminMembersService } from '../members/admin-members.service';
import { ShopProduct, ShopSale } from '../../core/models/shop-product.model';
import { UserProfile } from '../../core/models/user-profile.model';

import { TranslocoPipe } from '@jsverse/transloco';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

export interface PosCartItem {
  product: ShopProduct;
  quantity: number;
}

const QUICK_CASH_AMOUNTS = [20, 50, 100, 200, 500];

@Component({
  selector: 'app-admin-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-pos.html',
  styleUrl: './admin-pos.scss',
})
export class AdminPos {
  private readonly shopService = inject(AdminShopService);
  private readonly membersService = inject(AdminMembersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly quickCashAmounts = QUICK_CASH_AMOUNTS;

  // Search & Filters
  protected readonly search = signal<string>('');
  protected readonly selectedCategory = signal<string>('all');

  // Real-time Streams
  private readonly productData = toSignal(this.shopService.watchProducts(), { initialValue: null });
  private readonly salesData = toSignal(this.shopService.watchSales(), { initialValue: null });
  private readonly membersData = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });

  protected readonly products = computed(() => {
    const list = this.productData() ?? [];
    return list.filter((p) => p.status === 'active' && p.stock > 0);
  });

  protected readonly sales = computed(() => this.salesData() ?? []);
  protected readonly members = computed(() => this.membersData() ?? []);

  // Today's POS Total
  protected readonly todaySalesTotal = computed(() => {
    const list = this.sales();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list
      .filter((s) => s.status === 'completed' && (s.saleDate?.toMillis() ?? 0) >= todayMs)
      .reduce((sum, s) => sum + s.totalAmount, 0);
  });

  protected readonly todaySalesCount = computed(() => {
    const list = this.sales();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list.filter((s) => s.status === 'completed' && (s.saleDate?.toMillis() ?? 0) >= todayMs).length;
  });

  // Filtered Products
  protected readonly filteredProducts = computed(() => {
    const list = this.products();
    const cat = this.selectedCategory();
    const q = this.search().trim().toLowerCase();

    return list.filter((p) => {
      const matchCat = cat === 'all' || p.category?.toLowerCase() === cat.toLowerCase();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  // Cart State
  protected readonly cart = signal<PosCartItem[]>([]);
  protected readonly selectedMemberId = signal<string>('');
  protected readonly cashGiven = signal<number | null>(null);
  protected readonly isPaying = signal(false);

  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.uid === id) ?? null;
  });

  protected readonly cartTotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  );

  protected readonly changeDue = computed(() => {
    const given = this.cashGiven();
    const total = this.cartTotal();
    if (given === null || given < total) return 0;
    return given - total;
  });

  protected readonly canPayWithWallet = computed(() => {
    const mem = this.selectedMember();
    if (!mem) return false;
    return (mem.walletBalance ?? 0) >= this.cartTotal() && this.cart().length > 0;
  });

  // Cart Methods
  addToCart(product: ShopProduct): void {
    if (product.stock <= 0) return;

    this.cart.update((current) => {
      const existing = current.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          this.snackBar.open(`Yetersiz stok! Mevcut: ${product.stock}`, 'Tamam', { duration: 2000 });
          return current;
        }
        return current.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  increaseQty(productId: string): void {
    this.cart.update((current) =>
      current.map((item) => {
        if (item.product.id === productId && item.quantity < item.product.stock) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      }),
    );
  }

  decreaseQty(productId: string): void {
    this.cart.update((current) =>
      current
        .map((item) => {
          if (item.product.id === productId) {
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  }

  removeFromCart(productId: string): void {
    this.cart.update((current) => current.filter((i) => i.product.id !== productId));
  }

  clearCart(): void {
    this.cart.set([]);
    this.cashGiven.set(null);
  }

  setExactCash(): void {
    this.cashGiven.set(this.cartTotal());
  }

  setCashAmount(amt: number): void {
    this.cashGiven.set(amt);
  }

  async pay(paymentMethod: 'cash' | 'card' | 'wallet'): Promise<void> {
    if (this.saasSub.isExpired()) {
      void this.alertService.error(
        'SaaS Aboneliği Sona Erdi',
        'Salonunuzun SaaS lisansı sona erdiği için yeni kasa satışı ve tahsilat yapılamaz. Lütfen SaaS Paket & Lisans menüsünden paketinizi yenileyiniz.',
      );
      return;
    }

    const items = this.cart();
    if (items.length === 0 || this.isPaying()) return;

    const member = this.selectedMember();
    if (paymentMethod === 'wallet' && !member) {
      this.alertService.toastWarning('E-Cüzdan ile ödeme için lütfen bir üye seçin.');
      return;
    }

    this.isPaying.set(true);
    try {
      await this.shopService.checkout({
        items,
        paymentMethod,
        member,
        notes: `Hızlı Kasa (POS) ${member ? `[Üye: ${member.displayName}]` : '[Misafir]'}`,
      });

      const total = this.cartTotal();
      const change = this.changeDue();
      this.clearCart();

      let msg = `Tahsilat Başarılı! ₺${this.money(total)} (${paymentMethod === 'cash' ? 'Nakit' : paymentMethod === 'card' ? 'Kredi Kartı' : 'E-Cüzdan'})`;
      if (paymentMethod === 'cash' && change > 0) {
        msg += ` · Para Üstü: ₺${this.money(change)}`;
      }

      this.alertService.toastSuccess(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ödeme alınamadı.';
      this.alertService.toastError(msg);
    } finally {
      this.isPaying.set(false);
    }
  }
}
