import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatMoney } from '../../shared/ui/ui-utils';
import { AdminShopService } from '../shop/admin-shop.service';
import { ShopProduct, isLowStock } from '../../core/models/shop-product.model';
import { Supplier } from '../../core/models/supplier.model';
import { AdminSuppliersService } from '../suppliers/admin-suppliers.service';
import { PermissionService } from '../../core/services/permission.service';
import { of } from 'rxjs';
import {
  StockCategoryItem,
  ensureCategoryKey,
  matchesProductCategory,
  resolveCategoryEmoji,
} from '../../core/models/stock-category.model';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, PageHeader, SlideOver, Field, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts {
  private readonly fb = inject(FormBuilder);
  private readonly shopService = inject(AdminShopService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  /** Ürünü tedarikçi kaydına bağlamak için (sipariş ve minimum stok listesi tedarikçiye göre süzülür). */
  protected readonly suppliers = toSignal(
    inject(PermissionService).can('gymSuppliers') ? inject(AdminSuppliersService).watchSuppliers() : of([] as Supplier[]),
    { initialValue: [] as Supplier[] },
  );

  protected readonly money = formatMoney;

  // Dynamic Stock Categories
  protected readonly stockCategories = toSignal(this.shopService.watchCategories(), {
    initialValue: [] as StockCategoryItem[],
  });

  protected readonly filterCategories = computed(() => {
    const list = this.stockCategories();
    const seen = new Set<string>();
    const items: Array<{ id: string; key: string; name: string; label: string; icon: string; colorTag: string; rawId?: string }> = [
      { id: 'all', key: 'all', name: 'Tümü', label: 'Tümü', icon: '⚡', colorTag: 'indigo' },
    ];

    list.forEach((c, idx) => {
      const safeKey = ensureCategoryKey(c, idx);
      if (seen.has(safeKey)) return;
      seen.add(safeKey);
      items.push({
        id: safeKey,
        key: safeKey,
        name: c.name || safeKey,
        label: c.name || safeKey,
        icon: resolveCategoryEmoji(c.name || safeKey, c.icon),
        colorTag: c.colorTag || 'indigo',
        rawId: c.id,
      });
    });

    return items;
  });

  protected readonly selectedCategory = signal<string>('all');
  protected readonly search = signal<string>('');

  toggleFilterCategory(id: string): void {
    const target = id && id.trim() ? id.trim() : 'all';
    if (this.selectedCategory() === target) {
      this.selectedCategory.set('all');
    } else {
      this.selectedCategory.set(target);
    }
  }

  // Data
  private readonly productData = toSignal(this.shopService.watchProducts(), { initialValue: null });

  protected readonly products = computed(() => {
    const list = this.productData() ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  });

  protected readonly lowStockCount = computed(
    () => this.products().filter((p) => p.status === 'active' && isLowStock(p)).length,
  );

  protected readonly totalStockUnits = computed(
    () => this.products().reduce((sum, p) => sum + (p.stock || 0), 0),
  );

  protected readonly totalStockValue = computed(
    () => this.products().reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0),
  );

  protected readonly filteredProducts = computed(() => {
    const list = this.products();
    const cat = this.selectedCategory();
    const q = this.search().trim().toLowerCase();
    const selectedCatObj = cat === 'all' ? null : this.filterCategories().find((c) => c.id === cat);

    return list.filter((p) => {
      const matchCat =
        cat === 'all' ||
        matchesProductCategory(p.category, {
          id: selectedCatObj?.rawId || cat,
          key: selectedCatObj?.key || cat,
          name: selectedCatObj?.name || cat,
          label: selectedCatObj?.label || cat,
        });
      const matchQuery =
        !q ||
        (!!p.name && p.name.toLowerCase().includes(q)) ||
        (!!p.sku && p.sku.toLowerCase().includes(q)) ||
        (!!p.category && p.category.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  });

  // Drawer & Form
  protected readonly drawerOpen = signal(false);
  protected readonly editingProduct = signal<ShopProduct | null>(null);
  protected readonly submitting = signal(false);
  protected readonly seeding = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    category: ['protein', [Validators.required]],
    description: [''],
    cost: [0],
    supplier: [''],
    supplierId: [''],
    minStock: [null as number | null, [Validators.min(0)]],
    reorderQty: [null as number | null, [Validators.min(0)]],
    status: ['active' as ShopProduct['status']],
  });

  fieldErr(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  getCategoryItem(key?: string): StockCategoryItem | undefined {
    if (!key) return undefined;
    return this.stockCategories().find((c) => matchesProductCategory(key, c));
  }

  getCategoryLabel(key: string): string {
    const found = this.getCategoryItem(key);
    return found ? found.name : key;
  }

  getCategoryIcon(key: string): string {
    const found = this.getCategoryItem(key);
    return resolveCategoryEmoji(found?.name || key, found?.icon);
  }

  selectCategory(key: string): void {
    this.form.controls.category.setValue(key);
    this.form.controls.category.markAsDirty();
  }

  openCreate(): void {
    this.errorMessage.set('');
    this.editingProduct.set(null);
    const firstCat = this.stockCategories()[0];
    const defaultCat = firstCat ? ensureCategoryKey(firstCat, 0) : 'protein';
    this.form.reset({
      name: '',
      sku: `PRD-${Date.now().toString().slice(-4)}`,
      price: 0,
      stock: 10,
      category: defaultCat,
      description: '',
      cost: 0,
      supplier: '',
      supplierId: '',
      minStock: null,
      reorderQty: null,
      status: 'active',
    });
    this.form.controls.sku.enable();
    this.drawerOpen.set(true);
  }

  openEdit(p: ShopProduct): void {
    this.errorMessage.set('');
    this.editingProduct.set(p);
    const matchedCat = this.getCategoryItem(p.category);
    this.form.reset({
      name: p.name,
      sku: p.sku,
      price: p.price,
      stock: p.stock,
      category: matchedCat ? ensureCategoryKey(matchedCat) : p.category,
      description: p.description ?? '',
      cost: p.cost ?? 0,
      supplier: p.supplier ?? '',
      supplierId: p.supplierId ?? '',
      minStock: p.minStock ?? null,
      reorderQty: p.reorderQty ?? null,
      status: p.status,
    });
    this.form.controls.sku.disable();
    this.drawerOpen.set(true);
  }

  async quickAdjustStock(p: ShopProduct, delta: number): Promise<void> {
    const newStock = Math.max(0, p.stock + delta);
    try {
      await this.shopService.updateProduct(p.id, { stock: newStock });
      this.alertService.toastSuccess(`${p.name} stoğu güncellendi (${newStock} adet).`);
    } catch {
      this.alertService.toastError('Stok güncellenemedi.');
    }
  }

  async saveProduct(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Lütfen zorunlu alanları (Ürün Adı, Barkod/SKU, Satış Fiyatı, Stok) doldurunuz.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    const raw = this.form.getRawValue();
    const linked = this.suppliers().find((s) => s.id === raw.supplierId);
    const supplierFields = {
      supplier: linked?.name ?? raw.supplier,
      supplierId: linked?.id || undefined,
      minStock: raw.minStock ?? undefined,
      reorderQty: raw.reorderQty ?? undefined,
    };

    try {
      const editing = this.editingProduct();
      if (editing) {
        await this.shopService.updateProduct(editing.id, {
          name: raw.name,
          price: raw.price,
          stock: raw.stock,
          category: raw.category,
          description: raw.description,
          cost: raw.cost,
          ...supplierFields,
          status: raw.status,
        });
        this.alertService.toastSuccess('Ürün başarıyla güncellendi.');
      } else {
        await this.shopService.createProduct({
          name: raw.name,
          sku: raw.sku,
          price: raw.price,
          stock: raw.stock,
          category: raw.category,
          description: raw.description,
          cost: raw.cost,
          ...supplierFields,
        });
        this.alertService.toastSuccess('Yeni ürün başarıyla eklendi.');
      }
      this.drawerOpen.set(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kaydedilirken hata oluştu.';
      this.errorMessage.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  async deleteProduct(p: ShopProduct): Promise<void> {
    const confirmed = await this.alertService.deleteConfirm(p.name, 'Ürünü Sil');
    if (!confirmed) return;

    try {
      await this.shopService.deleteProduct(p.id);
      this.alertService.toastSuccess('Ürün silindi.');
    } catch {
      this.alertService.toastError('Ürün silinemedi.');
    }
  }

  async seedDefaultProducts(): Promise<void> {
    this.seeding.set(true);
    try {
      await this.shopService.seedDefaultProducts();
      this.alertService.toastSuccess('Örnek sporcu gıdası ve bar ürünleri yüklendi!');
    } catch {
      this.alertService.toastError('Ürünler yüklenirken hata oluştu.');
    } finally {
      this.seeding.set(false);
    }
  }
}
