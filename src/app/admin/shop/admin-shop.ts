import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatDateTime, formatMoney, sortDesc } from '../../shared/ui/ui-utils';
import { AdminShopService } from './admin-shop.service';
import { AdminMembersService } from '../members/admin-members.service';
import { ShopProduct, ShopSale } from '../../core/models/shop-product.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { StockCategoryItem } from '../../core/models/stock-category.model';

type Tab = 'pos' | 'products' | 'sales';

export interface CartItem {
  product: ShopProduct;
  quantity: number;
}

const PRODUCT_STATUS_LABEL: Record<ShopProduct['status'], string> = {
  active: 'Satışta',
  inactive: 'Pasif',
  discontinued: 'Üretimden Kalktı',
};

const PRODUCT_STATUS_CLASS: Record<ShopProduct['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  inactive: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  discontinued: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const SALE_STATUS_LABEL: Record<ShopSale['status'], string> = {
  completed: 'Tamamlandı',
  refunded: 'İade Edildi',
  pending: 'Beklemede',
};

const SALE_STATUS_CLASS: Record<ShopSale['status'], string> = {
  completed: PRODUCT_STATUS_CLASS.active,
  refunded: PRODUCT_STATUS_CLASS.discontinued,
  pending: PRODUCT_STATUS_CLASS.inactive,
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kredi Kartı',
  transfer: 'Havale',
  wallet: 'E-Cüzdan',
};

@Component({
  selector: 'app-admin-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-shop.html',
  styleUrl: './admin-shop.scss',
})
export class AdminShop {
  private readonly fb = inject(FormBuilder);
  private readonly shopService = inject(AdminShopService);
  private readonly membersService = inject(AdminMembersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  protected readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'pos', label: 'Kasa / POS', icon: 'point_of_sale' },
    { id: 'products', label: 'Ürün & Stok', icon: 'inventory_2' },
    { id: 'sales', label: 'Satış Raporları', icon: 'receipt_long' },
  ];

  private readonly rawCategories = toSignal(this.shopService.watchCategories(), {
    initialValue: [] as StockCategoryItem[],
  });

  protected readonly categories = computed(() => {
    const list = this.rawCategories();
    return [
      { id: 'all', label: 'Tümü', icon: '⚡' },
      ...list.map((c) => ({
        id: c.key,
        label: c.name,
        icon: c.icon || 'inventory_2',
      })),
    ];
  });

  protected readonly selectedCategory = signal<string>('all');
  protected readonly posSearch = signal<string>('');

  protected readonly productStatusLabel = PRODUCT_STATUS_LABEL;
  protected readonly productStatusClass = PRODUCT_STATUS_CLASS;
  protected readonly saleStatusLabel = SALE_STATUS_LABEL;
  protected readonly saleStatusClass = SALE_STATUS_CLASS;
  protected readonly paymentLabel = PAYMENT_LABEL;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  protected readonly tab = signal<Tab>('pos');

  // Real-time data streams
  private readonly productData = toSignal(this.shopService.watchProducts(), { initialValue: null });
  private readonly saleData = toSignal(this.shopService.watchSales(), { initialValue: null });
  private readonly membersData = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });

  protected readonly products = computed(() => {
    const list = this.productData();
    return list && [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  });

  protected readonly sales = computed(() => {
    const list = this.saleData();
    return list && sortDesc(list, (s) => s.saleDate);
  });

  protected readonly members = computed(() => this.membersData() ?? []);

  // POS Cart State
  protected readonly cart = signal<CartItem[]>([]);
  protected readonly selectedMemberId = signal<string>('');
  protected readonly isPaying = signal(false);
  protected readonly seeding = signal(false);

  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.uid === id) ?? null;
  });

  protected readonly sellableProducts = computed(() =>
    (this.products() ?? []).filter((p) => p.status === 'active' && p.stock > 0),
  );

  protected readonly filteredProducts = computed(() => {
    const list = this.products() ?? [];
    const cat = this.selectedCategory();
    const search = this.posSearch().trim().toLowerCase();

    return list.filter((p) => {
      const matchCat = cat === 'all' || p.category?.toLowerCase() === cat.toLowerCase();
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });
  });

  protected readonly lowStockCount = computed(
    () => (this.products() ?? []).filter((p) => p.status === 'active' && p.stock <= 5).length,
  );

  protected readonly todaySalesTotal = computed(() => {
    const list = this.sales() ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list
      .filter((s) => s.status === 'completed' && (s.saleDate?.toMillis() ?? 0) >= todayMs)
      .reduce((sum, s) => sum + s.totalAmount, 0);
  });

  protected readonly todaySalesCount = computed(() => {
    const list = this.sales() ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return list.filter((s) => s.status === 'completed' && (s.saleDate?.toMillis() ?? 0) >= todayMs).length;
  });

  // Cart Computations
  protected readonly cartItemCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0),
  );

  protected readonly cartSubtotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  );

  protected readonly cartTotal = computed(() => this.cartSubtotal());

  protected readonly hasSufficientBalance = computed(() => {
    const mem = this.selectedMember();
    if (!mem) return false;
    return (mem.walletBalance ?? 0) >= this.cartTotal();
  });

  protected readonly canPayWithWallet = computed(() => {
    return this.selectedMember() !== null && this.hasSufficientBalance() && this.cart().length > 0;
  });

  // Drawer / Form state for product creation
  protected readonly productDrawer = signal(false);
  protected readonly editingProduct = signal<ShopProduct | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    category: ['protein', [Validators.required]],
    description: [''],
    cost: [0],
    supplier: [''],
    status: ['active' as ShopProduct['status']],
  });

  // CART OPERATIONS
  addToCart(product: ShopProduct): void {
    if (product.stock <= 0) return;

    this.cart.update((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          this.snackBar.open(`Maksimum mevcut stok: ${product.stock} adet.`, 'Tamam', { duration: 2500 });
          return current;
        }
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
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
    this.cart.update((current) => current.filter((item) => item.product.id !== productId));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  onMemberSelect(memberId: string): void {
    this.selectedMemberId.set(memberId);
  }

  async pay(paymentMethod: 'wallet' | 'cash' | 'card'): Promise<void> {
    const items = this.cart();
    if (items.length === 0 || this.isPaying()) return;

    const member = this.selectedMember();
    if (paymentMethod === 'wallet' && !member) {
      this.snackBar.open('E-Cüzdan ile ödeme için lütfen bir üye seçin.', 'Kapat', { duration: 3000 });
      return;
    }

    this.isPaying.set(true);
    try {
      await this.shopService.checkout({
        items,
        paymentMethod,
        member,
      });

      const total = this.cartTotal();
      this.clearCart();

      const methodMsg =
        paymentMethod === 'wallet'
          ? `Üyenin (${member?.displayName}) E-Cüzdanından ${formatMoney(total)} tahsil edildi.`
          : `${formatMoney(total)} tahsilat (${PAYMENT_LABEL[paymentMethod]}) kaydedildi.`;

      this.snackBar.open(`Satış Başarılı! 🎉 ${methodMsg}`, 'Kapat', { duration: 4000 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Satış sırasında hata oluştu.';
      this.snackBar.open(msg, 'Kapat', { duration: 4000 });
    } finally {
      this.isPaying.set(false);
    }
  }

  async seedProducts(): Promise<void> {
    this.seeding.set(true);
    try {
      await this.shopService.seedDefaultProducts();
      this.snackBar.open('Popüler Vitamin Bar ürünleri başarıyla yüklendi! 🥤', 'Harika', { duration: 3500 });
    } catch (err) {
      this.snackBar.open('Ürünler yüklenirken hata oluştu.', 'Kapat', { duration: 3000 });
    } finally {
      this.seeding.set(false);
    }
  }

  // PRODUCT CRUD
  productErr(name: keyof typeof this.productForm.controls, messages: Record<string, string>): string {
    return firstError(this.productForm.controls[name], messages);
  }

  openProductForm(p?: ShopProduct): void {
    this.errorMessage.set('');
    this.editingProduct.set(p ?? null);
    if (p) {
      this.productForm.reset({
        name: p.name,
        sku: p.sku,
        price: p.price,
        stock: p.stock,
        category: p.category,
        description: p.description ?? '',
        cost: p.cost ?? 0,
        supplier: p.supplier ?? '',
        status: p.status,
      });
      this.productForm.controls.sku.disable();
    } else {
      this.productForm.reset({
        name: '',
        sku: `PRD-${Date.now().toString().slice(-4)}`,
        price: 0,
        stock: 10,
        category: 'protein',
        description: '',
        cost: 0,
        supplier: '',
        status: 'active',
      });
      this.productForm.controls.sku.enable();
    }
    this.productDrawer.set(true);
  }

  closeProduct(): void {
    this.productDrawer.set(false);
    this.editingProduct.set(null);
  }

  async submitProduct(): Promise<void> {
    if (this.productForm.invalid || this.submitting()) {
      this.productForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.productForm.getRawValue();
      const current = this.editingProduct();
      if (current) {
        await this.shopService.updateProduct(current.id, v);
      } else {
        await this.shopService.createProduct(v);
      }
      this.closeProduct();
      this.snackBar.open(current ? 'Ürün güncellendi.' : 'Yeni ürün eklendi.', 'Kapat', { duration: 3000 });
    } catch (e: unknown) {
      this.errorMessage.set(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      this.submitting.set(false);
    }
  }

  async removeProduct(p: ShopProduct): Promise<void> {
    if (!(await this.alertService.deleteConfirm(p.name))) return;
    try {
      await this.shopService.deleteProduct(p.id);
      this.alertService.toastSuccess('Ürün silindi.');
    } catch {
      this.alertService.toastError('Silme işlemi başarısız.');
    }
  }

  async refund(sale: ShopSale): Promise<void> {
    const ok = await this.alertService.actionConfirm(
      'Satış İadesi',
      `<strong>"${sale.productName}"</strong> satışını iade etmek istediğinize emin misiniz?<br><br><span class="text-xs text-slate-500 dark:text-slate-400">Ürün adedi stoğa geri eklenecektir.</span>`,
      'İade Et',
      'warning',
    );
    if (!ok) return;
    try {
      await this.shopService.refundSale(sale);
      this.alertService.toastSuccess('Satış iade edildi, stok güncellendi.');
    } catch {
      this.alertService.toastError('İade başarısız.');
    }
  }
}
