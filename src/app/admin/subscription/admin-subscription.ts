import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { CheckoutBuyer, PaymentProviders, PaymentsApi } from '../../core/api/payments.api';

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-admin-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TranslocoPipe],
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
  private readonly route = inject(ActivatedRoute);

  readonly paymentProviders = signal<PaymentProviders | null>(null);
  readonly serverPrices = signal<Record<SaasPlanId, Record<SaasBillingCycle, number>> | null>(null);
  readonly paymentError = signal('');
  readonly paymentResult = signal<{ id: string; status: string } | null>(null);
  readonly providerBusy = signal(false);
  readonly buyerIdentity = signal('');
  readonly buyerPhone = signal('');
  readonly buyerEmail = signal('');
  readonly buyerAddress = signal('');
  readonly buyerCity = signal('');

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (profile) {
        this.buyerEmail.set(profile.email || '');
        this.buyerIdentity.set(profile.nationalId || '');
        this.buyerPhone.set(profile.phone || '');
        void this.loadPayments();
      }
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const sessionId = params.get('paymentSession');
      if (sessionId) void this.readPaymentResult(sessionId);
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
    } catch {
      this.paymentError.set('MainApi ödeme bilgileri alınamadı.');
    }
  }

  async enableSandbox(): Promise<void> {
    this.providerBusy.set(true);
    this.paymentError.set('');
    try {
      await firstValueFrom(this.payments.selectProvider('iyzico'));
      await this.loadPayments();
    } catch (err: any) {
      this.paymentError.set(err?.message || 'iyzico sandbox etkinleştirilemedi.');
    } finally {
      this.providerBusy.set(false);
    }
  }

  private async readPaymentResult(id: string): Promise<void> {
    try {
      await this.auth.waitUntilReady();
      let session = await firstValueFrom(this.payments.session(id));
      if (session.source !== 'saas_subscription') return;
      if (session.status === 'pending') session = await firstValueFrom(this.payments.reconcile(id));
      this.paymentResult.set({ id, status: session.status });
    } catch (err: any) {
      this.paymentError.set(err?.message || 'Test ödeme sonucu alınamadı.');
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
  readonly upgrading = signal(false);

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

  async confirmUpgrade(): Promise<void> {
    const target = this.selectedTargetPlan();
    if (!target) return;
    this.paymentError.set('');
    if (this.paymentProviders()?.selected !== 'iyzico' ||
      !this.paymentProviders()?.available.find((item) => item.id === 'iyzico')?.configured) {
      this.paymentError.set('Önce iyzico sandbox sağlayıcısını etkinleştirin.');
      return;
    }
    const fullName = (this.auth.profile()?.displayName || '').trim().split(/\s+/);
    const buyer: CheckoutBuyer = {
      name: fullName.slice(0, -1).join(' ') || fullName[0] || '',
      surname: fullName.length > 1 ? fullName.at(-1)! : fullName[0] || '',
      identityNumber: this.buyerIdentity().trim(),
      email: this.buyerEmail().trim(),
      gsmNumber: this.buyerPhone().trim(),
      address: this.buyerAddress().trim(), city: this.buyerCity().trim(), country: 'Turkey',
    };
    if (!/^\d{11}$/.test(buyer.identityNumber) || !buyer.email.includes('@') ||
      !buyer.gsmNumber || !buyer.address || !buyer.city) {
      this.paymentError.set('Kimlik no, e-posta, telefon, adres ve şehir alanlarını doldurun.');
      return;
    }
    this.upgrading.set(true);
    try {
      const order = await firstValueFrom(this.payments.createSaasOrder(target.id, this.selectedCycle()));
      const session = await firstValueFrom(this.payments.checkoutSaas(order.id, buyer));
      if (!session.paymentPageUrl) throw new Error('iyzico ödeme sayfası oluşturulamadı.');
      window.location.assign(session.paymentPageUrl);
    } catch (err: any) {
      this.paymentError.set(err?.message || 'Sandbox ödeme başlatılamadı.');
    } finally {
      this.upgrading.set(false);
    }
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
