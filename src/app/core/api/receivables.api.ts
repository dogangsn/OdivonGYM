import { Injectable, inject } from '@angular/core';
import { EMPTY, expand, map, reduce } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  DebtorRow,
  InstallmentSaleInput,
  OverdueInstallmentRow,
  Receivable,
  ReceivablePaymentInput,
  ReceivableStatus,
} from '../models/receivable.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class ReceivablesApi {
  private readonly api = inject(ApiClient);

  /** Tüm planlar: API sayfa başına en fazla 100 kayıt döndürür, `nextCursor` bitene kadar okunur. */
  list(query: { userId?: string; status?: ReceivableStatus } = {}) {
    const page = (cursor?: string) =>
      this.api
        .get<{ items: Receivable[]; nextCursor: string | null }>('/gym/receivables', { limit: 100, ...query, cursor })
        .pipe(map((r) => ({ items: unwrapList<Receivable>(r.data), nextCursor: r.data?.nextCursor ?? null })));
    return page().pipe(
      expand((result) => (result.nextCursor ? page(result.nextCursor) : EMPTY)),
      reduce((all, result) => [...all, ...result.items], [] as Receivable[]),
    );
  }

  get(id: string) {
    return this.api.get<Receivable>(`/gym/receivables/${id}`).pipe(map((r) => r.data));
  }

  debtors() {
    return this.api.get<DebtorRow[]>('/gym/receivables/debtors').pipe(map((r) => unwrapList<DebtorRow>(r.data)));
  }

  overdue() {
    return this.api
      .get<OverdueInstallmentRow[]>('/gym/receivables/overdue')
      .pipe(map((r) => unwrapList<OverdueInstallmentRow>(r.data)));
  }

  createSale(body: InstallmentSaleInput) {
    return this.api.post<Receivable>('/gym/receivables', body).pipe(map((r) => r.data));
  }

  pay(id: string, body: ReceivablePaymentInput) {
    return this.api.post<Receivable>(`/gym/receivables/${id}/payments`, body).pipe(map((r) => r.data));
  }

  cancel(id: string, reason?: string) {
    return this.api.post<Receivable>(`/gym/receivables/${id}/cancel`, { reason }).pipe(map((r) => r.data));
  }
}
