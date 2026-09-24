import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-admin-subscription',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-subscription.html',
  styleUrl: './admin-subscription.scss',
})
export class AdminSubscription {
  protected readonly subService = inject(SaasSubscriptionService);
  private readonly transloco = inject(TranslocoService);

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

    this.upgrading.set(true);
    try {
      await this.subService.selectPlan(target.id, this.selectedCycle());
      this.closeUpgradeModal();
    } finally {
      this.upgrading.set(false);
    }
  }

  getPrice(plan: SaasPlan): number {
    return this.selectedCycle() === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  }

  getMonthlyEquivalent(plan: SaasPlan): number {
    return Math.round(plan.priceYearly / 12);
  }

  getPeriodLabel(): string {
    return this.selectedCycle() === 'yearly'
      ? this.transloco.translate('saasSubscription.perYear')
      : this.transloco.translate('saasSubscription.perMonth');
  }
}
