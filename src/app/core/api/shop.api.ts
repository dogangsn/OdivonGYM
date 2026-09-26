import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { ShopProduct, ShopSale } from '../models/shop-product.model';
import { StockCategoryItem } from '../models/stock-category.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class ShopApi {
  private readonly api = inject(ApiClient);

  listCategories() {
    return this.api
      .get<StockCategoryItem[]>('/gym/shop/categories', { limit: 100 })
      .pipe(map((r) => unwrapList<StockCategoryItem>(r.data)));
  }

  createCategory(body: unknown) {
    return this.api.post<StockCategoryItem>('/gym/shop/categories', body).pipe(map((r) => r.data));
  }

  updateCategory(id: string, body: unknown) {
    return this.api.patch<StockCategoryItem>(`/gym/shop/categories/${id}`, body).pipe(map((r) => r.data));
  }

  removeCategory(id: string) {
    return this.api.delete<{ id: string }>(`/gym/shop/categories/${id}`).pipe(map((r) => r.data));
  }

  listProducts() {
    return this.api.get<ShopProduct[]>('/gym/shop/products', { limit: 100 }).pipe(map((r) => unwrapList<ShopProduct>(r.data)));
  }

  createProduct(body: unknown) {
    return this.api.post<ShopProduct>('/gym/shop/products', body).pipe(map((r) => r.data));
  }

  updateProduct(id: string, body: unknown) {
    return this.api.patch<ShopProduct>(`/gym/shop/products/${id}`, body).pipe(map((r) => r.data));
  }

  removeProduct(id: string) {
    return this.api.delete<{ id: string }>(`/gym/shop/products/${id}`).pipe(map((r) => r.data));
  }

  listSales() {
    return this.api.get<ShopSale[]>('/gym/shop/sales', { limit: 100 }).pipe(map((r) => unwrapList<ShopSale>(r.data)));
  }

  checkout(body: unknown) {
    return this.api.post('/gym/shop/checkout', body).pipe(map((r) => r.data));
  }

  refund(id: string) {
    return this.api.post<ShopSale>(`/gym/shop/sales/${id}/refund`, {}).pipe(map((r) => r.data));
  }

  removeSale(id: string) {
    return this.api.delete<{ id: string }>(`/gym/shop/sales/${id}`).pipe(map((r) => r.data));
  }
}
