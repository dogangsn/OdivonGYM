import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

export type IyzicoMode = 'sandbox' | 'live';

/** Salonun kendi iyzico ayarı; anahtarlar asla dönmez, yalnızca son 4 karakter. */
export interface GymPaymentSettings {
  provider: 'iyzico';
  configured: boolean;
  enabled: boolean;
  mode: IyzicoMode;
  apiKeyHint: string | null;
  secretKeyHint: string | null;
  lastTest: { ok: boolean; message: string | null; at: string } | null;
  updatedAt: string | null;
}

export interface SaveGymPaymentSettings {
  apiKey?: string;
  secretKey?: string;
  mode?: IyzicoMode;
  enabled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentSettingsApi {
  private readonly api = inject(ApiClient);

  get() {
    return this.api.get<GymPaymentSettings>('/gym/payment-settings').pipe(map((r) => r.data));
  }

  save(body: SaveGymPaymentSettings) {
    return this.api.put<GymPaymentSettings>('/gym/payment-settings', body).pipe(map((r) => r.data));
  }

  test(body: { apiKey?: string; secretKey?: string; mode?: IyzicoMode }) {
    return this.api
      .post<{ ok: boolean; message: string | null; mode: IyzicoMode }>('/gym/payment-settings/test', body)
      .pipe(map((r) => r.data));
  }

  remove() {
    return this.api.delete<GymPaymentSettings>('/gym/payment-settings').pipe(map((r) => r.data));
  }
}
