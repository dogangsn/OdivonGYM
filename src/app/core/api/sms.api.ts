import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

export type SmsProviderType = 'netgsm' | 'iletimerkezi' | 'twilio' | 'simulator';

export interface SmsGatewayConfig {
  tenantId?: string;
  provider: SmsProviderType;
  header: string;
  apiKey?: string;
  apiSecret?: string;
  senderPhone?: string;
  isActive: boolean;
  balanceCredits?: number;
}

export interface SmsSendResult {
  success: boolean;
  totalRequested: number;
  sentCount: number;
  failedCount: number;
  provider: SmsProviderType;
  batchId: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SmsApi {
  private readonly api = inject(ApiClient);

  getConfig() {
    return this.api.get<SmsGatewayConfig | null>('/gym/sms/config').pipe(map((r) => r.data));
  }

  saveConfig(body: unknown) {
    return this.api.patch<SmsGatewayConfig>('/gym/sms/config', body).pipe(map((r) => r.data));
  }

  send(body: unknown) {
    return this.api.post<SmsSendResult>('/gym/sms/send', body).pipe(map((r) => r.data));
  }
}
