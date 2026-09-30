import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
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

  list(query: { userId?: string; status?: ReceivableStatus } = {}) {
    return this.api
      .get<Receivable[]>('/gym/receivables', { limit: 500, ...query })
      .pipe(map((r) => unwrapList<Receivable>(r.data)));
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
