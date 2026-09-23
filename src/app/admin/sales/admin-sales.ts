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
import { AdminPackagesService } from '../packages/admin-packages.service';
import { ShopProduct } from '../../core/models/shop-product.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { GymPackage } from '../../core/models/gym-package.model';
import { StockCategoryItem } from '../../core/models/stock-category.model';

export interface SalesCartItem {
  type: 'product' | 'package';
  product?: ShopProduct;
  gymPackage?: GymPackage;
  quantity: number;
  isPackageIncluded: boolean;
  unitPrice: number;
}

@Component({
  selector: 'app-admin-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-sales.html',
  styleUrl: './admin-sales.scss',
})
export class AdminSales {
  private readonly shopService = inject(AdminShopService);
  private readonly membersService = inject(AdminMembersService);
  private readonly packagesService = inject(AdminPackagesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  // View modes: 'products' (Market Satışı) | 'packages' (Paket Satışı)
  protected readonly saleCatalogMode = signal<'products' | 'packages'>('products');
  protected readonly selectedCategory = signal<string>('all');

  private readonly rawCategories = toSignal(this.shopService.watchCategories(), {
    initialValue: [] as StockCategoryItem[],
  });

  protected readonly productCategories = computed(() => {
    const list = this.rawCategories();
    return [
      { id: 'all', label: 'Tüm Ürünler', icon: '⚡' },
      ...list.map((c) => ({
        id: c.key,
        label: c.name,
        icon: c.icon || 'inventory_2',
      })),
    ];
  });

  protected readonly searchQuery = signal<string>('');

  // Data signals
  private readonly productData = toSignal(this.shopService.watchProducts(), { initialValue: null });
  private readonly membersData = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  private readonly packagesData = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });

  protected readonly products = computed(() => {
    const list = this.productData() ?? [];
    return list.filter((p) => p.status === 'active' && p.stock > 0);
  });

  protected readonly members = computed(() => this.membersData() ?? []);
  protected readonly availablePackages = computed(() => {
    const list = this.packagesData() ?? [];
    return list.filter((p) => p.status === 'active');
  });

  // Selected Member
  protected readonly selectedMemberId = signal<string>('');
  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.uid === id) ?? null;
  });

  // Member's Active Package Info & Perks
  protected readonly memberPackageInfo = computed(() => {
    const mem = this.selectedMember();
    if (!mem) return null;

    const label = mem.packageLabel?.trim() || 'Paket Bilgisi Yok';
    const hasActiveStatus = mem.membershipStatus === 'active';

    // Find matched GymPackage definition if possible
    const pkg = this.availablePackages().find(
      (p) => p.name.toLowerCase() === label.toLowerCase(),
    );

    const features = pkg?.features ?? [];
    const isVip = label.toLowerCase().includes('vip') || label.toLowerCase().includes('full');

    return {
      name: label,
      status: mem.membershipStatus,
      hasActiveStatus,
      isVip,
      features,
      walletBalance: mem.walletBalance ?? 0,
      memberNumber: mem.memberNumber || mem.uid.slice(0, 5),
    };
  });

  // Filtered Products
  protected readonly filteredProducts = computed(() => {
    const list = this.products();
    const cat = this.selectedCategory();
    const search = this.searchQuery().trim().toLowerCase();

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

  // Cart State
  protected readonly cart = signal<SalesCartItem[]>([]);
  protected readonly isPaying = signal(false);

  // Cart Computations
  protected readonly cartCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0),
  );

  protected readonly cartTotal = computed(() =>
    this.cart().reduce((sum, item) => {
      if (item.isPackageIncluded) return sum;
      return sum + item.unitPrice * item.quantity;
    }, 0),
  );

  protected readonly hasSufficientBalance = computed(() => {
    const mem = this.selectedMember();
    if (!mem) return false;
    return (mem.walletBalance ?? 0) >= this.cartTotal();
  });

  protected readonly canPayWithWallet = computed(() => {
    return this.selectedMember() !== null && this.hasSufficientBalance() && this.cart().length > 0;
  });

  /**
   * Üyenin aktif paketine göre bir ürünün "Pakete Dahil" olup olmadığını akıllıca kontrol eder.
   */
  isProductEligibleForPackage(product: ShopProduct): boolean {
    const pkg = this.memberPackageInfo();
    if (!pkg || !pkg.hasActiveStatus) return false;

    // VIP / Full paketler su ve içecekleri otomatik kapsar
    const prodName = product.name.toLowerCase();
    const prodCat = product.category.toLowerCase();

    if (pkg.isVip) {
      if (prodCat === 'drink' || prodName.includes('su') || prodName.includes('havlu')) {
        return true;
      }
    }

    // Paketin tanımlı özellikleri içinde ürün adı veya kategorisi geçiyor mu?
    for (const feat of pkg.features) {
      const f = feat.toLowerCase();
      if (f.includes(prodName) || f.includes(prodCat)) return true;
      if (prodCat === 'drink' && (f.includes('su') || f.includes('içecek'))) return true;
      if (f.includes('havlu') && prodName.includes('havlu')) return true;
      if (f.includes('shake') && (prodName.includes('shake') || prodCat === 'protein')) return true;
    }

    return false;
  }

  // Cart Actions
  addProductToCart(product: ShopProduct): void {
    if (product.stock <= 0) return;

    const isIncluded = this.isProductEligibleForPackage(product);

    this.cart.update((current) => {
      const existing = current.find(
        (item) => item.type === 'product' && item.product?.id === product.id,
      );

      if (existing) {
        if (existing.quantity >= product.stock) {
          this.snackBar.open(`Maksimum mevcut stok: ${product.stock} adet.`, 'Tamam', { duration: 2500 });
          return current;
        }
        return current.map((item) =>
          item.product?.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          type: 'product',
          product,
          quantity: 1,
          isPackageIncluded: isIncluded,
          unitPrice: product.price,
        },
      ];
    });

    if (isIncluded) {
      this.alertService.toastSuccess(`${product.name} üyenin paketine dahil olduğu için ücretsiz hak olarak sepete eklendi! 🎉`);
    }
  }

  addPackageToCart(pkg: GymPackage): void {
    this.cart.update((current) => {
      const existing = current.find(
        (item) => item.type === 'package' && item.gymPackage?.id === pkg.id,
      );

      if (existing) {
        return current.map((item) =>
          item.gymPackage?.id === pkg.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          type: 'package',
          gymPackage: pkg,
          quantity: 1,
          isPackageIncluded: false,
          unitPrice: pkg.price,
        },
      ];
    });
  }

  togglePackageIncluded(index: number): void {
    this.cart.update((current) => {
      const updated = [...current];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          isPackageIncluded: !updated[index].isPackageIncluded,
        };
      }
      return updated;
    });
  }

  increaseQty(index: number): void {
    this.cart.update((current) => {
      const item = current[index];
      if (!item) return current;

      if (item.type === 'product' && item.product) {
        if (item.quantity >= item.product.stock) return current;
      }

      const updated = [...current];
      updated[index] = { ...item, quantity: item.quantity + 1 };
      return updated;
    });
  }

  decreaseQty(index: number): void {
    this.cart.update((current) => {
      const item = current[index];
      if (!item) return current;

      if (item.quantity <= 1) {
        return current.filter((_, i) => i !== index);
      }

      const updated = [...current];
      updated[index] = { ...item, quantity: item.quantity - 1 };
      return updated;
    });
  }

  removeItem(index: number): void {
    this.cart.update((current) => current.filter((_, i) => i !== index));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  onMemberSelect(memberId: string): void {
    this.selectedMemberId.set(memberId);

    // Re-evaluate existing cart items package eligibility
    this.cart.update((items) =>
      items.map((item) => {
        if (item.type === 'product' && item.product) {
          const eligible = this.isProductEligibleForPackage(item.product);
          return { ...item, isPackageIncluded: eligible };
        }
        return item;
      }),
    );
  }

  async checkout(paymentMethod: 'wallet' | 'cash' | 'card' | 'transfer'): Promise<void> {
    const items = this.cart();
    if (items.length === 0 || this.isPaying()) return;

    const member = this.selectedMember();
    if (paymentMethod === 'wallet' && !member) {
      this.alertService.toastWarning('E-Cüzdan ile ödeme için lütfen bir üye seçin.');
      return;
    }

    this.isPaying.set(true);
    try {
      // 1. Check out market products if any
      const productItems = items
        .filter((i) => i.type === 'product' && i.product)
        .map((i) => ({
          product: i.product!,
          quantity: i.quantity,
          isPackageIncluded: i.isPackageIncluded,
        }));

      if (productItems.length > 0) {
        await this.shopService.checkout({
          items: productItems,
          paymentMethod,
          member,
          notes: member ? `Üye: ${member.displayName} (#${member.memberNumber || member.uid.slice(0, 5)})` : 'Misafir Satışı',
        });
      }

      // 2. Process package sales if any
      const packageItems = items.filter((i) => i.type === 'package' && i.gymPackage);
      for (const pItem of packageItems) {
        if (member && pItem.gymPackage) {
          const now = new Date();
          const endDate = new Date(now.getTime() + pItem.gymPackage.durationDays * 24 * 60 * 60 * 1000);
          await this.membersService.updateMember(member.uid, {
            displayName: member.displayName,
            phone: member.phone || '',
            gender: member.gender || 'unspecified',
            birthDate: member.birthDate ? member.birthDate.toDate() : null,
            notes: member.notes || '',
            membershipStatus: 'active',
            packageLabel: pItem.gymPackage.name,
            membershipStartDate: now,
            membershipEndDate: endDate,
          });
        }
      }

      const total = this.cartTotal();
      this.clearCart();

      const successMsg = total === 0
        ? 'Pakete dahil ücretsiz ürünler teslim edildi ve stoktan düşüldü! 🎁'
        : `Satış Başarılı! Toplam ₺${this.money(total)} tahsil edildi. 🎉`;

      this.alertService.toastSuccess(successMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Satış işlemi gerçekleştirilemedi.';
      this.alertService.toastError(msg);
    } finally {
      this.isPaying.set(false);
    }
  }
}
