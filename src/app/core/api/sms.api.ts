import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

export type SmsProviderType =
  | 'netgsm'
  | 'iletimerkezi'
  | 'mutlucell'
  | 'verimor'
  | 'twilio'
  | 'simulator';

export interface SmsProviderField {
  key: string;
  label: string;
  placeholder: string;
  isSecret?: boolean;
}

export interface SmsProviderMetadata {
  id: SmsProviderType;
  name: string;
  description: string;
  protocol: string;
  fields: SmsProviderField[];
  requiresHeader: boolean;
}

export interface SmsGatewayConfig {
  tenantId?: string;
  provider: SmsProviderType;
  isActive: boolean;
  defaultHeader?: string;
  netgsm?: { usercode?: string; password?: string; header?: string };
  iletimerkezi?: { apiKey?: string; apiHash?: string; sender?: string };
  mutlucell?: { username?: string; password?: string; originator?: string };
  verimor?: { username?: string; password?: string; header?: string };
  twilio?: { accountSid?: string; authToken?: string; fromNumber?: string };
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed';
  lastTestMessage?: string;
  balanceCache?: { balance: number; currency: string; fetchedAt: string };
  availableProviders?: SmsProviderMetadata[];
}

export interface SmsBalanceResult {
  success: boolean;
  balance: number;
  currency: 'CREDIT' | 'TL' | 'USD';
  provider?: string;
  message?: string;
}

export interface SmsSendResult {
  success: boolean;
  totalRequested: number;
  sentCount: number;
  failedCount: number;
  provider: string;
  batchId?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class SmsApi {
  private readonly api = inject(ApiClient);

  getConfig() {
    return this.api.get<SmsGatewayConfig>('/gym/sms/config').pipe(map((r) => r.data));
  }

  saveConfig(body: Partial<SmsGatewayConfig>) {
    return this.api.patch<SmsGatewayConfig>('/gym/sms/config', body).pipe(map((r) => r.data));
  }

  getBalance() {
    return this.api.post<SmsBalanceResult>('/gym/sms/balance', {}).pipe(map((r) => r.data));
  }

  sendTest(body: { phone: string; message?: string; header?: string }) {
    return this.api.post<SmsSendResult>('/gym/sms/test', body).pipe(map((r) => r.data));
  }

  send(body: { recipients: string[]; message: string; header?: string; title?: string }) {
    return this.api.post<SmsSendResult>('/gym/sms/send', body).pipe(map((r) => r.data));
  }
}

