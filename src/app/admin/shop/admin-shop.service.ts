import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { ShopApi } from '../../core/api/shop.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateShopProductInput,
  CreateShopSaleInput,
  ShopProduct,
  ShopSale,
  UpdateShopProductInput,
} from '../../core/models/shop-product.model';
import { DEFAULT_STOCK_CATEGORIES, StockCategoryItem } from '../../core/models/stock-category.model';
import { UserProfile } from '../../core/models/user-profile.model';

@Injectable({ providedIn: 'root' })
export class AdminShopService {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchCategories(): Observable<StockCategoryItem[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listCategories());
  }

  async createCategory(
    input: Omit<StockCategoryItem, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const created = await firstValueFrom(this.api.createCategory(input));
    this.reload$.next();
    return created.id ?? '';
  }

  async updateCategory(id: string, input: Partial<StockCategoryItem>): Promise<void> {
    await firstValueFrom(this.api.updateCategory(id, input));
    this.reload$.next();
  }

  async deleteCategory(id: string): Promise<void> {
    await firstValueFrom(this.api.removeCategory(id));
    this.reload$.next();
  }

  async seedDefaultCategoriesIfEmpty(_tenantIdParam?: string): Promise<void> {
    const existing = await firstValueFrom(this.api.listCategories());
    const keys = new Set(existing.map((c) => c.key));
    for (const cat of DEFAULT_STOCK_CATEGORIES) {
      if (keys.has(cat.key)) continue;
      await this.createCategory(cat);
    }
  }

  watchProducts(): Observable<ShopProduct[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listProducts());
  }

  watchSales(): Observable<ShopSale[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listSales());
  }

  async createProduct(input: CreateShopProductInput): Promise<string> {
    const created = await firstValueFrom(this.api.createProduct({ ...input, status: 'active' }));
    this.reload$.next();
    return created.id;
  }

  async updateProduct(id: string, input: UpdateShopProductInput): Promise<void> {
    await firstValueFrom(this.api.updateProduct(id, input));
    this.reload$.next();
  }

  async deleteProduct(id: string): Promise<void> {
    await firstValueFrom(this.api.removeProduct(id));
    this.reload$.next();
  }

  async recordSale(input: CreateShopSaleInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.checkout({
        productId: input.productId,
        productName: input.productName,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: input.totalAmount,
        paymentMethod: input.paymentMethod,
        userId: input.userId,
        discount: input.discount,
        notes: input.notes,
      }),
    );
    this.reload$.next();
    return (created as ShopSale).id || '';
  }

  async refundSale(sale: ShopSale): Promise<void> {
    await firstValueFrom(this.api.refund(sale.id));
    this.reload$.next();
  }

  async deleteSale(id: string): Promise<void> {
    await firstValueFrom(this.api.removeSale(id));
    this.reload$.next();
  }

  async checkout(input: {
    items: { product: ShopProduct; quantity: number; isPackageIncluded?: boolean }[];
    paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
    member?: UserProfile | null;
    discount?: number;
    notes?: string;
  }): Promise<void> {
    await firstValueFrom(
      this.api.checkout({
        userId: input.member?.uid,
        paymentMethod: input.paymentMethod,
        discount: input.discount,
        notes: input.notes,
        items: input.items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          isPackageIncluded: item.isPackageIncluded,
        })),
      }),
    );
    this.reload$.next();
  }

  async seedDefaultProducts(): Promise<void> {
    const defaults: CreateShopProductInput[] = [
      { name: 'Optimum Whey Protein (30g Saşe)', sku: 'WHEY-01', price: 85, stock: 50, category: 'protein' },
      { name: 'Soğuk Doğal Kaynak Suyu (500ml)', sku: 'WATER-01', price: 15, stock: 120, category: 'drink' },
      { name: 'Odivon GYM Shaker (700ml)', sku: 'SHK-01', price: 180, stock: 20, category: 'accessory' },
    ];
    for (const p of defaults) {
      await this.createProduct(p);
    }
  }
}
