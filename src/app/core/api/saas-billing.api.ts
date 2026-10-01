import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

/** Odivon aboneliğinin sunucudaki durumu (yalnızca sunucu değiştirir). */
export interface SaasBillingStatus {
  membershipStatus: string;
  subscriptionEndsAt: string | null;
  graceEndsAt: string | null;
  inGrace: boolean;
  graceDays: number;
  daysLeft: number | null;
}

export interface SaasPaymentRecord {
  id: string;
  receiptNo: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  amountKurus: number;
  mode: 'sandbox' | 'live';
  periodStartsAt: string;
  periodEndsAt: string;
  paidAt: string;
}

export interface SaasNotice {
  id: string;
  type: 'saas_expiring' | 'saas_grace';
  daysLeft: number;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SaasBillingApi {
  private readonly api = inject(ApiClient);

  status() {
    return this.api.get<SaasBillingStatus>('/gym/saas-billing/status').pipe(map((r) => r.data));
  }

  payments() {
    return this.api.get<SaasPaymentRecord[]>('/gym/saas-billing/payments').pipe(map((r) => r.data ?? []));
  }

  notices() {
    return this.api.get<SaasNotice[]>('/gym/saas-billing/notices', undefined, { skipLoading: true }).pipe(map((r) => r.data ?? []));
  }

  readNotices() {
    return this.api.post<{ updated: number }>('/gym/saas-billing/notices/read', {}).pipe(map((r) => r.data));
  }
}
