import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, of, startWith, Subject, switchMap } from 'rxjs';
import { GymApi } from '../api/gym.api';
import { SaasApi } from '../api/saas.api';
import { AuthService } from '../auth/auth.service';
import {
  GymSaasSubscription,
  SAAS_PLANS_CONFIG,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanFeatureKeys,
  SaasPlanId,
} from '../models/saas-plan.model';
import { BranchContextService } from './branch-context.service';

@Injectable({ providedIn: 'root' })
export class SaasSubscriptionService {
  private readonly api = inject(SaasApi);
  private readonly gym = inject(GymApi);
  private readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly reload$ = new Subject<void>();

  readonly subscription$ = toObservable(this.auth.profile).pipe(
    switchMap((profile) => {
      if (!profile?.tenantId) return of(null);
      return this.reload$.pipe(
        startWith(null),
        switchMap(() => this.api.get()),
      );
    }),
  );

  private readonly remoteSubscription = toSignal(this.subscription$, { initialValue: null });

  readonly subscription = computed<GymSaasSubscription>(() => {
    const remote = this.remoteSubscription();
    if (remote && remote.planId) {
      return remote;
    }
    const authStatus = this.auth.membershipStatus() || 'trial';
    const tenantId = this.auth.profile()?.tenantId || 'default-tenant';
    const trialDays = this.auth.trialDaysLeft();
    return {
      tenantId,
      planId: 'pro',
      billingCycle: 'monthly',
      status: authStatus === 'expired' ? 'expired' : authStatus === 'active' ? 'active' : 'trial',
      trialEndsAt: new Date(Date.now() + trialDays * 86400000).toISOString(),
      currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  readonly activePlan = computed<SaasPlan>(() => {
    const planId = this.subscription().planId || 'pro';
    return SAAS_PLANS_CONFIG[planId] || SAAS_PLANS_CONFIG.pro;
  });

  readonly billingCycle = computed<SaasBillingCycle>(() => this.subscription().billingCycle || 'monthly');
  readonly demoSimulateExpired = signal<boolean>(false);

  toggleDemoExpired(): void {
    this.demoSimulateExpired.update((v) => !v);
  }

  readonly isTrial = computed(() => this.subscription().status === 'trial');
  readonly isExpired = computed(
    () =>
      this.demoSimulateExpired() ||
      this.auth.profile()?.email === 'expired@odivongym.app' ||
      this.subscription().status === 'expired' ||
      this.auth.isTrialExpired(),
  );
  readonly isActive = computed(() => this.subscription().status === 'active' && !this.isExpired());
  readonly trialDaysLeft = computed(() => this.auth.trialDaysLeft());
  readonly branchCount = computed(() => this.branchContext.branches().length || 1);

  private readonly liveMemberCount = signal<number>(0);
  private readonly liveStaffCount = signal<number>(0);

  readonly memberCount = computed(() => this.liveMemberCount());
  readonly staffCount = computed(() => this.liveStaffCount());

  constructor() {
    toObservable(this.auth.profile).subscribe((profile) => {
      if (!profile?.tenantId) return;
      void firstValueFrom(this.gym.listMembers()).then((members) => this.liveMemberCount.set(members.length));
      void firstValueFrom(this.gym.listStaff()).then((staff) => this.liveStaffCount.set(staff.length));
    });
  }

  readonly branchUsagePct = computed(() => {
    const max = this.activePlan().limits.maxBranches;
    if (max >= 9999) return 15;
    return Math.min(100, Math.round((this.branchCount() / max) * 100));
  });

  readonly memberUsagePct = computed(() => {
    const max = this.activePlan().limits.maxMembers;
    if (max >= 999999) return 20;
    return Math.min(100, Math.round((this.memberCount() / max) * 100));
  });

  readonly staffUsagePct = computed(() => {
    const max = this.activePlan().limits.maxStaff;
    if (max >= 9999) return 10;
    return Math.min(100, Math.round((this.staffCount() / max) * 100));
  });

  canAddBranch(): { allowed: boolean; reason?: string } {
    const limit = this.activePlan().limits.maxBranches;
    const current = this.branchCount();
    if (current >= limit) {
      return {
        allowed: false,
        reason: `Mevcut "${this.activePlan().name}" paketiniz en fazla ${limit} şubeye izin vermektedir (${current}/${limit}). Yeni şube açmak için paketinizi yükseltin.`,
      };
    }
    return { allowed: true };
  }

  canAddMember(): { allowed: boolean; reason?: string } {
    const limit = this.activePlan().limits.maxMembers;
    const current = this.memberCount();
    if (current >= limit) {
      return {
        allowed: false,
        reason: `Mevcut "${this.activePlan().name}" paketinizin aktif üye kotası doldu (${current}/${limit}). Yeni üye kaydı için paketinizi yükseltin.`,
      };
    }
    return { allowed: true };
  }

  canAddStaff(): { allowed: boolean; reason?: string } {
    const limit = this.activePlan().limits.maxStaff;
    const current = this.staffCount();
    if (current >= limit) {
      return {
        allowed: false,
        reason: `Mevcut "${this.activePlan().name}" paketiniz en fazla ${limit} personel hesabına izin vermektedir (${current}/${limit}).`,
      };
    }
    return { allowed: true };
  }

  hasFeature(featureKey: keyof SaasPlanFeatureKeys): boolean {
    return !!this.activePlan().featureKeys[featureKey];
  }

  async selectPlan(planId: SaasPlanId, billingCycle: SaasBillingCycle = 'monthly'): Promise<void> {
    const plan = SAAS_PLANS_CONFIG[planId];
    if (!plan) return;
    const now = new Date();
    const periodDays = billingCycle === 'yearly' ? 365 : 30;
    await firstValueFrom(
      this.api.save({
        planId,
        billingCycle,
        status: 'active',
        currentPeriodStartsAt: now.toISOString(),
        currentPeriodEndsAt: new Date(now.getTime() + periodDays * 86400000).toISOString(),
      }),
    );
    this.reload$.next();
    this.snackBar.open(
      `Tebrikler! ${plan.name} (${billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}) paketi başarıyla aktif edildi!`,
      'Tamam',
      { duration: 5000, panelClass: ['snack-success'] },
    );
  }
}
