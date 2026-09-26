import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { AccountingEntry } from '../models/accounting-entry.model';
import { unwrapList } from './unwrap';

export interface AccountingCategoryDto {
  id?: string;
  tenantId?: string;
  name: string;
  type: 'income' | 'expense' | 'both';
}

@Injectable({ providedIn: 'root' })
export class AccountingApi {
  private readonly api = inject(ApiClient);

  list() {
    return this.api
      .get<AccountingEntry[]>('/gym/accounting', { limit: 100 })
      .pipe(map((r) => unwrapList<AccountingEntry>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<AccountingEntry>('/gym/accounting', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<AccountingEntry>(`/gym/accounting/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/accounting/${id}`).pipe(map((r) => r.data));
  }

  listCategories() {
    return this.api
      .get<AccountingCategoryDto[]>('/gym/accounting/categories', { limit: 100 })
      .pipe(map((r) => unwrapList<AccountingCategoryDto>(r.data)));
  }

  createCategory(body: unknown) {
    return this.api.post<AccountingCategoryDto>('/gym/accounting/categories', body).pipe(map((r) => r.data));
  }

  removeCategory(id: string) {
    return this.api.delete<{ id: string }>(`/gym/accounting/categories/${id}`).pipe(map((r) => r.data));
  }
}
