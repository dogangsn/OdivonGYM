import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { EInvoiceConfig, EInvoiceItem } from '../models/e-invoice.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class EinvoiceApi {
  private readonly api = inject(ApiClient);

  getConfig() {
    return this.api.get<EInvoiceConfig | null>('/gym/einvoice/config').pipe(map((r) => r.data));
  }

  saveConfig(body: unknown) {
    return this.api.patch<EInvoiceConfig>('/gym/einvoice/config', body).pipe(map((r) => r.data));
  }

  listItems() {
    return this.api
      .get<EInvoiceItem[]>('/gym/einvoice/items', { limit: 100 })
      .pipe(map((r) => unwrapList<EInvoiceItem>(r.data)));
  }

  createItem(body: unknown) {
    return this.api.post<EInvoiceItem>('/gym/einvoice/items', body).pipe(map((r) => r.data));
  }

  updateItem(id: string, body: unknown) {
    return this.api.patch<EInvoiceItem>(`/gym/einvoice/items/${id}`, body).pipe(map((r) => r.data));
  }

  removeItem(id: string) {
    return this.api.delete<{ id: string }>(`/gym/einvoice/items/${id}`).pipe(map((r) => r.data));
  }
}
