import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  SAAS_PLANS_CONFIG,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanId,
} from '../../core/models/saas-plan.model';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';
import { FEATURES } from '../../core/config/features';
import { AuthService } from '../../core/auth/auth.service';
import { PaymentProviders, PaymentsApi } from '../../core/api/payments.api';
import { SaasBillingApi, SaasBillingStatus, SaasPaymentRecord } from '../../core/api/saas-billing.api';
import { SaasCheckout } from '../../shared/components/saas-checkout/saas-checkout';
import { formatDate, formatMoney } from '../../shared/ui/ui-utils';

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-admin-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TranslocoPipe, SaasCheckout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-subscription.html',
  styleUrl: './admin-subscription.scss',
})
export class AdminSubscription {
  protected readonly subService = inject(SaasSubscriptionService);
  protected readonly features = FEATURES;
  private readonly transloco = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentsApi);

  readonly paymentProviders = signal<PaymentProviders | null>(null);
  readonly serverPrices = signal<Record<SaasPlanId, Record<SaasBillingCycle, number>> | null>(null);
  readonly paymentError = signal('');
  private readonly billingApi = inject(SaasBillingApi);
  protected readonly date = formatDate;
  protected readonly money = formatMoney;
  /** Sunucudaki abonelik durumu (bitiş, ek süre) ve ödeme geçmişi; yalnızca ödeme sonrası değişir. */
  readonly billing = signal<SaasBillingStatus | null>(null);
  readonly receipts = signal<SaasPaymentRecord[]>([]);

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile) {
        void this.loadPayments();
      }
    });
  }

  private async loadPayments(): Promise<void> {
    try {
      const [providers, prices] = await Promise.all([
        firstValueFrom(this.payments.providers()), firstValueFrom(this.payments.saasPrices()),
      ]);
      this.paymentProviders.set(providers);
      this.serverPrices.set(prices);
      this.paymentError.set('');
      const [billing, receipts] = await Promise.all([firstValueFrom(this.billingApi.status()), firstValueFrom(this.billingApi.payments())]);
      this.billing.set(billing);
      this.receipts.set(receipts);
    } catch {
      this.paymentError.set('MainApi ödeme bilgileri alınamadı.');
    }
  }

  // Fatura Döngüsü (Aylık / Yıllık)
  readonly selectedCycle = signal<SaasBillingCycle>('yearly'); // Default to yearly to show value

  // Planlar listesi
  readonly plans = computed<SaasPlan[]>(() => [
    SAAS_PLANS_CONFIG.starter,
    SAAS_PLANS_CONFIG.pro,
    SAAS_PLANS_CONFIG.enterprise,
  ]);

  // Aktif plan
  readonly activePlan = computed(() => this.subService.activePlan());

  // Yükseltme modalı durumu
  readonly upgradeModalOpen = signal(false);
  readonly selectedTargetPlan = signal<SaasPlan | null>(null);

  // FAQ Accordion State
  readonly openFaqIndex = signal<number | null>(0);

  readonly faqs: FaqItem[] = [
    {
      questionKey: 'saasSubscription.faq1Q',
      answerKey: 'saasSubscription.faq1A',
    },
    {
      questionKey: 'saasSubscription.faq2Q',
      answerKey: 'saasSubscription.faq2A',
    },
    {
      questionKey: 'saasSubscription.faq3Q',
      answerKey: 'saasSubscription.faq3A',
    },
    {
      questionKey: 'saasSubscription.faq4Q',
      answerKey: 'saasSubscription.faq4A',
    },
    {
      questionKey: 'saasSubscription.faq5Q',
      answerKey: 'saasSubscription.faq5A',
    },
  ];

  setCycle(cycle: SaasBillingCycle): void {
    this.selectedCycle.set(cycle);
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update((current) => (current === index ? null : index));
  }

  isCurrentPlan(planId: SaasPlanId): boolean {
    return this.activePlan().id === planId;
  }

  openUpgradeModal(plan: SaasPlan): void {
    this.selectedTargetPlan.set(plan);
    this.upgradeModalOpen.set(true);
  }

  closeUpgradeModal(): void {
    this.upgradeModalOpen.set(false);
    this.selectedTargetPlan.set(null);
  }

  getPrice(plan: SaasPlan): number {
    return this.serverPrices()?.[plan.id]?.[this.selectedCycle()] ??
      (this.selectedCycle() === 'yearly' ? plan.priceYearly : plan.priceMonthly);
  }

  getMonthlyEquivalent(plan: SaasPlan): number {
    return Math.round((this.serverPrices()?.[plan.id]?.yearly ?? plan.priceYearly) / 12);
  }

  getPeriodLabel(): string {
    return this.selectedCycle() === 'yearly'
      ? this.transloco.translate('saasSubscription.perYear')
      : this.transloco.translate('saasSubscription.perMonth');
  }
}
