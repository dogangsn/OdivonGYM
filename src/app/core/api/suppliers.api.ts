import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { Supplier, SupplierCategoryItem } from '../models/supplier.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class SuppliersApi {
  private readonly api = inject(ApiClient);

  listCategories() {
    return this.api
      .get<SupplierCategoryItem[]>('/gym/suppliers/categories', { limit: 100 })
      .pipe(map((r) => unwrapList<SupplierCategoryItem>(r.data)));
  }

  createCategory(body: unknown) {
    return this.api.post<SupplierCategoryItem>('/gym/suppliers/categories', body).pipe(map((r) => r.data));
  }

  updateCategory(id: string, body: unknown) {
    return this.api.patch<SupplierCategoryItem>(`/gym/suppliers/categories/${id}`, body).pipe(map((r) => r.data));
  }

  removeCategory(id: string) {
    return this.api.delete<{ id: string }>(`/gym/suppliers/categories/${id}`).pipe(map((r) => r.data));
  }

  list() {
    return this.api.get<Supplier[]>('/gym/suppliers', { limit: 100 }).pipe(map((r) => unwrapList<Supplier>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<Supplier>('/gym/suppliers', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<Supplier>(`/gym/suppliers/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/suppliers/${id}`).pipe(map((r) => r.data));
  }
}
