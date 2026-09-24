import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../../shared/components/logo-mark/logo-mark';
import {
  SAAS_PLANS_CONFIG,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanId,
} from '../../../core/models/saas-plan.model';
import { SaasSubscriptionService } from '../../../core/services/saas-subscription.service';

@Component({
  selector: 'app-trial-expired',
  standalone: true,
  imports: [CommonModule, LogoMark, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trial-expired.html',
  styleUrl: './trial-expired.scss',
})
export class TrialExpired {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly subService = inject(SaasSubscriptionService);
  private readonly transloco = inject(TranslocoService);

  readonly selectedCycle = signal<SaasBillingCycle>('monthly');
  readonly activating = signal<string | null>(null);

  protected readonly cancelled = computed(() => this.auth.membershipStatus() === 'cancelled');

  readonly plans = computed<SaasPlan[]>(() => [
    SAAS_PLANS_CONFIG.starter,
    SAAS_PLANS_CONFIG.pro,
    SAAS_PLANS_CONFIG.enterprise,
  ]);

  setCycle(cycle: SaasBillingCycle): void {
    this.selectedCycle.set(cycle);
  }

  getPrice(plan: SaasPlan): number {
    return this.selectedCycle() === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  }

  getPeriodLabel(): string {
    return this.selectedCycle() === 'yearly'
      ? this.transloco.translate('trialExpired.perYear')
      : this.transloco.translate('trialExpired.perMonth');
  }

  async activatePlan(planId: SaasPlanId): Promise<void> {
    this.activating.set(planId);
    try {
      await this.subService.selectPlan(planId, this.selectedCycle());
      // Başarılı abonelik sonrası hemen admin paneline yönlendir
      await this.router.navigateByUrl('/admin/overview');
    } finally {
      this.activating.set(null);
    }
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    await this.router.navigateByUrl('/auth/login');
  }
}

