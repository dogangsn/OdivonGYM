import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { AccountingEntry } from '../models/accounting-entry.model';
import {
  GymDailyClosing,
  PreClosePreviewResponse,
  SubmitDailyCloseDto,
  ExpenseAnalyticsResponse,
} from '../models/daily-close.model';
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

  // Daily Close (Z Report)
  getDailyClosePreview(date?: string, branchId?: string) {
    return this.api
      .get<PreClosePreviewResponse>('/gym/daily-close/preview', {
        date: date || undefined,
        branchId: branchId || undefined,
      })
      .pipe(map((r) => r.data));
  }

  submitDailyClose(body: SubmitDailyCloseDto) {
    return this.api.post<GymDailyClosing>('/gym/daily-close', body).pipe(map((r) => r.data));
  }

  listDailyClosings(branchId?: string, limit = 50) {
    return this.api
      .get<GymDailyClosing[]>('/gym/daily-close', { branchId: branchId || undefined, limit })
      .pipe(map((r) => unwrapList<GymDailyClosing>(r.data)));
  }

  getDailyCloseById(id: string) {
    return this.api.get<GymDailyClosing>(`/gym/daily-close/${id}`).pipe(map((r) => r.data));
  }

  verifyDailyClose(id: string, notes?: string) {
    return this.api.post<GymDailyClosing>(`/gym/daily-close/${id}/verify`, { notes }).pipe(map((r) => r.data));
  }

  // Expense Analytics
  getExpenseAnalytics(params?: { startDate?: string; endDate?: string; branchId?: string }) {
    return this.api
      .get<ExpenseAnalyticsResponse>('/gym/accounting/expenses/analytics', {
        startDate: params?.startDate,
        endDate: params?.endDate,
        branchId: params?.branchId,
      })
      .pipe(map((r) => r.data));
  }
}

