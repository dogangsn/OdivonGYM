import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatMoney, formatDateTime, toMillis } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { AdminMembersService } from '../members/admin-members.service';
import { ShopProduct, ShopSale } from '../../core/models/shop-product.model';
import { DEFAULT_STOCK_CATEGORIES, StockCategoryItem } from '../../core/models/stock-category.model';
import { UserProfile } from '../../core/models/user-profile.model';

import { TranslocoPipe } from '@jsverse/transloco';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';
import { ExitPaymentsService } from '../exit-payments/exit-payments.service';

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
  private readonly exitPaymentsService = inject(ExitPaymentsService);
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
  private readonly rawCategories = toSignal(this.shopService.watchCategories(), {
    initialValue: [] as StockCategoryItem[],
  });

  protected readonly categories = computed(() => {
    const list = this.rawCategories() ?? [];
    const baseList: Array<{ id: string; label: string; icon?: string }> = [
      { id: 'all', label: 'Tümü', icon: '⚡' },
    ];

    const sourceCategories = list.length > 0 ? list : DEFAULT_STOCK_CATEGORIES;
    const seen = new Set<string>();

    for (const c of sourceCategories) {
      const key = (c.key || c.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        seen.add(c.name.toLowerCase());
        baseList.push({
          id: c.key,
          label: c.name,
          icon: c.icon || '📦',
        });
      }
    }

    // Ek olarak aktif ürünlerde tanımlı ama kategorilerde yer almayan başlıkları da ekle
    for (const p of this.products()) {
      const pCat = p.category?.trim();
      if (pCat && !seen.has(pCat.toLowerCase())) {
        seen.add(pCat.toLowerCase());
        baseList.push({
          id: pCat,
          label: pCat,
          icon: '🏷️',
        });
      }
    }

    return baseList;
  });

  protected readonly products = computed(() => {
    const list = this.productData() ?? [];
    return list.filter((p) => p.status === 'active' && p.stock > 0);
  });

  protected readonly sales = computed(() => this.salesData() ?? []);
  protected readonly members = computed(() => this.membersData() ?? []);

  // Today's POS Total (toMillis safe check)
  protected readonly todaySalesTotal = computed(() => {
    const list = this.sales();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list
      .filter((s) => s.status === 'completed' && toMillis(s.saleDate) >= todayMs)
      .reduce((sum, s) => sum + s.totalAmount, 0);
  });

  protected readonly todaySalesCount = computed(() => {
    const list = this.sales();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list.filter((s) => s.status === 'completed' && toMillis(s.saleDate) >= todayMs).length;
  });

  // Filtered Products
  protected readonly filteredProducts = computed(() => {
    const list = this.products();
    const cat = this.selectedCategory();
    const q = this.search().trim().toLowerCase();
    const catItem = cat === 'all' ? null : this.categories().find((c) => c.id === cat);

    return list.filter((p) => {
      let matchCat = cat === 'all';
      if (!matchCat) {
        const prodCat = (p.category ?? '').trim().toLowerCase();
        const selectedId = (cat ?? '').trim().toLowerCase();
        const selectedLabel = (catItem?.label ?? '').trim().toLowerCase();

        matchCat = (!!selectedId && prodCat === selectedId) || (!!selectedLabel && prodCat === selectedLabel);
      }

      const matchQuery =
        !q ||
        (!!p.name && p.name.toLowerCase().includes(q)) ||
        (!!p.sku && p.sku.toLowerCase().includes(q)) ||
        (!!p.category && p.category.toLowerCase().includes(q));

      return matchCat && matchQuery;
    });
  });

  // Cart State & Searchable Member Dropdown
  protected readonly cart = signal<PosCartItem[]>([]);
  protected readonly selectedMemberId = signal<string>('');
  protected readonly isMemberDropdownOpen = signal<boolean>(false);
  protected readonly memberSearchQuery = signal<string>('');
  protected readonly remoteSearchedMembers = signal<UserProfile[]>([]);
  protected readonly searchingMembers = signal<boolean>(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly maxDropdownMembers = 30;
  protected readonly cashGiven = signal<number | null>(null);
  protected readonly isPaying = signal(false);

  /** Yalnızca aktif veya deneme sürecinde olan, süresi dolmamış ve arşivlenmemiş üyeler POS'ta listelenir. */
  private isActivePosMember(m: UserProfile): boolean {
    if (m.isArchived || m.archivedAt) return false;
    if (m.membershipStatus !== 'active' && m.membershipStatus !== 'trial') return false;
    const endMs = m.membershipEndsAt ? toMillis(m.membershipEndsAt) : 0;
    if (endMs > 0 && endMs <= Date.now()) return false;
    return true;
  }

  protected readonly activeMembersPool = computed(() => {
    const map = new Map<string, UserProfile>();
    for (const m of this.members()) {
      if (m.uid && this.isActivePosMember(m)) map.set(m.uid, m);
    }
    for (const m of this.remoteSearchedMembers()) {
      if (m.uid && this.isActivePosMember(m)) map.set(m.uid, m);
    }
    return Array.from(map.values());
  });

  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.activeMembersPool().find((m) => m.uid === id) ?? this.members().find((m) => m.uid === id) ?? null;
  });

  private readonly allMatchedMembers = computed(() => {
    const q = this.memberSearchQuery().trim().toLocaleLowerCase('tr');
    const list = this.activeMembersPool();
    if (!q) return list;
    return list.filter((m) =>
      (m.displayName ?? '').toLocaleLowerCase('tr').includes(q) ||
      (m.email ?? '').toLocaleLowerCase('tr').includes(q) ||
      (m.phone ?? '').toLocaleLowerCase('tr').includes(q) ||
      String(m.memberNumber ?? '').toLocaleLowerCase('tr').includes(q) ||
      (m.packageLabel ?? '').toLocaleLowerCase('tr').includes(q) ||
      (m.rfidCardNumber ?? '').toLocaleLowerCase('tr').includes(q),
    );
  });

  protected readonly totalMatchedMembersCount = computed(() => this.allMatchedMembers().length);

  /** Binlerce üyede DOM performans kaybını önlemek için en fazla 30 kayıt render edilir. */
  protected readonly filteredMembers = computed(() =>
    this.allMatchedMembers().slice(0, this.maxDropdownMembers),
  );

  constructor() {
    effect(() => {
      const q = this.memberSearchQuery();
      this.triggerRemoteMemberSearch(q);
    });
  }

  onMemberSearchInput(value: string): void {
    this.memberSearchQuery.set(value ?? '');
  }

  private triggerRemoteMemberSearch(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const trimmed = (value ?? '').trim();
    if (trimmed.length < 2) {
      this.searchingMembers.set(false);
      return;
    }
    this.searchingMembers.set(true);
    this.searchTimer = setTimeout(async () => {
      const results = await this.membersService.searchMembers(trimmed, {
        status: 'active_or_trial',
        archived: false,
        limit: 30,
      });
      this.remoteSearchedMembers.set(results);
      this.searchingMembers.set(false);
    }, 250);
  }

  toggleMemberDropdown(): void {
    const next = !this.isMemberDropdownOpen();
    this.isMemberDropdownOpen.set(next);
    if (next) {
      this.memberSearchQuery.set('');
    }
  }

  closeMemberDropdown(): void {
    this.isMemberDropdownOpen.set(false);
  }

  selectMemberFromDropdown(memberId: string): void {
    this.selectedMemberId.set(memberId);
    this.isMemberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  clearSelectedMember(event: Event): void {
    event.stopPropagation();
    this.selectMemberFromDropdown('');
  }

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

  // Çıkışta Ödeyecek (Açık Fiş) Modal State
  protected readonly showExitPaymentModal = signal(false);
  protected readonly exitPaymentNote = signal('');
  protected readonly exitPaymentAmount = signal<number | null>(null);
  protected readonly savingExitPayment = signal(false);

  openExitPaymentDialog(): void {
    if (this.cart().length === 0) {
      this.alertService.toastWarning('Lütfen önce sepete ürün ekleyin.');
      return;
    }
    const member = this.selectedMember();
    this.exitPaymentAmount.set(this.cartTotal());
    this.exitPaymentNote.set(member ? `${member.displayName} (Çıkışta Ödeyecek)` : '');
    this.showExitPaymentModal.set(true);
  }

  closeExitPaymentDialog(): void {
    this.showExitPaymentModal.set(false);
    this.exitPaymentNote.set('');
    this.exitPaymentAmount.set(null);
  }

  async submitExitPayment(): Promise<void> {
    if (this.saasSub.isExpired()) {
      void this.alertService.error(
        'SaaS Aboneliği Sona Erdi',
        'Salonunuzun SaaS lisansı sona erdiği için işlem yapılamaz.',
      );
      return;
    }

    const note = this.exitPaymentNote().trim();
    if (!note) {
      this.alertService.toastWarning('Lütfen takip edebilmek için bir açıklama / not veya eşkal yazın (örn. Dolap No, kıyafet tanımı, kişi adı).');
      return;
    }

    const items = this.cart();
    if (items.length === 0 || this.savingExitPayment()) return;

    this.savingExitPayment.set(true);
    try {
      const member = this.selectedMember();
      const amount = this.exitPaymentAmount() ?? this.cartTotal();

      await this.exitPaymentsService.createExitPayment({
        note,
        customerName: member ? member.displayName : 'Misafir / Anonim',
        userId: member ? member.uid : null,
        totalAmount: amount,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.product.price,
        })),
      });

      this.clearCart();
      this.closeExitPaymentDialog();
      this.alertService.toastSuccess(
        `Çıkışta ödeme kaydı açıldı! "${note}" tutarı: ${this.money(amount)}. Satış menüsündeki "Çıkışta Ödemeler" ekranından tahsil edebilirsiniz.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kayıt oluşturulamadı.';
      this.alertService.toastError(msg);
    } finally {
      this.savingExitPayment.set(false);
    }
  }

  async pay(paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer'): Promise<void> {
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
    if (paymentMethod === 'wallet') {
      if (!member) {
        this.alertService.toastWarning('E-Cüzdan ile ödeme için lütfen bir müşteri/üye seçin.');
        return;
      }
      if (!this.canPayWithWallet()) {
        this.alertService.toastWarning(`Seçili üyenin cüzdan bakiyesi yetersiz (Bakiye: ${this.money(member.walletBalance || 0)}).`);
        return;
      }
    }

    this.isPaying.set(true);
    try {
      const itemsSummary = items
        .map((i) => `${i.quantity}x ${i.product.name} (${this.money(i.product.price)})`)
        .join(', ');

      await this.shopService.checkout({
        items,
        paymentMethod,
        member,
        notes: `Hızlı Kasa (POS) ${member ? `[Üye: ${member.displayName}]` : '[Misafir]'} · Ürünler: ${itemsSummary}`,
      });

      const total = this.cartTotal();
      const change = this.changeDue();
      this.clearCart();

      let msg = `Tahsilat Başarılı! ${this.money(total)} (${
        paymentMethod === 'cash'
          ? 'Nakit'
          : paymentMethod === 'card'
            ? 'Kredi Kartı'
            : paymentMethod === 'transfer'
              ? 'Havale/EFT'
              : 'E-Cüzdan'
      })`;
      if (paymentMethod === 'cash' && change > 0) {
        msg += ` · Para Üstü: ${this.money(change)}`;
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
