import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { SaasBillingCycle, SaasPlanId } from '../models/saas-plan.model';

export interface PaymentProviders {
  available: Array<{ id: 'iyzico'; mode: 'sandbox'; configured: boolean }>;
  selected: 'iyzico' | 'none';
}

export interface PaymentSession {
  id: string;
  source: 'saas_subscription' | 'vet_sale' | 'gym_receivable';
  amountKurus: number;
  status: 'initializing' | 'pending' | 'succeeded' | 'failed';
  paymentPageUrl: string | null;
}

export interface CheckoutBuyer {
  name: string;
  surname: string;
  identityNumber: string;
  email: string;
  gsmNumber: string;
  address: string;
  city: string;
  country: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly api = inject(ApiClient);

  providers() {
    return this.api.get<PaymentProviders>('/payments/providers').pipe(map((r) => r.data));
  }

  selectProvider(provider: 'iyzico' | 'none') {
    return this.api.put('/payments/provider', { provider }).pipe(map((r) => r.data));
  }

  saasPrices() {
    return this.api.get<Record<SaasPlanId, Record<SaasBillingCycle, number>>>('/payments/saas-plans')
      .pipe(map((r) => r.data));
  }

  createSaasOrder(planId: SaasPlanId, billingCycle: SaasBillingCycle) {
    return this.api.post<{ id: string; amountKurus: number }>('/payments/saas-orders', { planId, billingCycle })
      .pipe(map((r) => r.data));
  }

  checkoutSaas(sourceId: string, buyer: CheckoutBuyer) {
    return this.api.post<PaymentSession>('/payments/checkout', {
      source: 'saas_subscription', sourceId, ...buyer,
    }).pipe(map((r) => r.data));
  }

  session(id: string) {
    return this.api.get<PaymentSession>(`/payments/sessions/${encodeURIComponent(id)}`).pipe(map((r) => r.data));
  }

  reconcile(id: string) {
    return this.api.post<PaymentSession>(`/payments/sessions/${encodeURIComponent(id)}/reconcile`, {})
      .pipe(map((r) => r.data));
  }
}
