import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  CollectExitPaymentInput,
  CreateExitPaymentInput,
  ExitPayment,
} from '../models/exit-payment.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class ExitPaymentApi {
  private readonly api = inject(ApiClient);

  list(status?: string) {
    const params: Record<string, string | number> = { limit: 100 };
    if (status) params['status'] = status;
    return this.api
      .get<ExitPayment[]>('/gym/shop/exit-payments', params)
      .pipe(map((r) => unwrapList<ExitPayment>(r.data)));
  }

  create(body: CreateExitPaymentInput) {
    return this.api.post<ExitPayment>('/gym/shop/exit-payments', body).pipe(map((r) => r.data));
  }

  update(id: string, body: Partial<CreateExitPaymentInput>) {
    return this.api
      .patch<ExitPayment>(`/gym/shop/exit-payments/${id}`, body)
      .pipe(map((r) => r.data));
  }

  collect(id: string, body: CollectExitPaymentInput) {
    return this.api
      .post<{ tab: ExitPayment }>(`/gym/shop/exit-payments/${id}/collect`, body)
      .pipe(map((r) => r.data));
  }

  cancel(id: string) {
    return this.api
      .post<ExitPayment>(`/gym/shop/exit-payments/${id}/cancel`, {})
      .pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api
      .delete<{ id: string }>(`/gym/shop/exit-payments/${id}`)
      .pipe(map((r) => r.data));
  }
}
