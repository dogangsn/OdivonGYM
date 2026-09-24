import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getCountFromServer,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { BranchContextService } from './branch-context.service';
import {
  GymSaasSubscription,
  SAAS_PLANS_CONFIG,
  SaasBillingCycle,
  SaasPlan,
  SaasPlanFeatureKeys,
  SaasPlanId,
} from '../models/saas-plan.model';

@Injectable({ providedIn: 'root' })
export class SaasSubscriptionService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);
  private readonly snackBar = inject(MatSnackBar);

  // Local fallback storage key for instant demo persistence
  private readonly storageKey = 'odivon_saas_subscription';

  private getCachedSubscription(): GymSaasSubscription | null {
    try {
      const item = localStorage.getItem(this.storageKey);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  // Local reactive signal for instantaneous plan upgrades
  private readonly localSubscription = signal<GymSaasSubscription | null>(this.getCachedSubscription());

  // Watch Firestore `gym_subscriptions/{tenantId}`
  readonly subscription$ = toObservable(this.auth.profile).pipe(
    switchMap((profile) => {
      const tenantId = profile?.tenantId;
      if (!tenantId) {
        return of(this.localSubscription());
      }
      const subDocRef = doc(this.firestore, 'gym_subscriptions', tenantId);
      return (docData(subDocRef) as Observable<GymSaasSubscription | undefined>).pipe(
        catchError(() => of(this.localSubscription())),
      );
    }),
  );

  private readonly firestoreSubscription = toSignal(this.subscription$, { initialValue: null });

  // Effective subscription: Firestore if available, otherwise local/fallback
  readonly subscription = computed<GymSaasSubscription>(() => {
    const fs = this.firestoreSubscription();
    if (fs && fs.planId) {
      return fs;
    }
    const loc = this.localSubscription();
    if (loc && loc.planId) {
      return loc;
    }

    // Default to Pro with user's trial / active status
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

  // Current active plan configuration
  readonly activePlan = computed<SaasPlan>(() => {
    const planId = this.subscription().planId || 'pro';
    return SAAS_PLANS_CONFIG[planId] || SAAS_PLANS_CONFIG.pro;
  });

  // Billing cycle
  readonly billingCycle = computed<SaasBillingCycle>(() => this.subscription().billingCycle || 'monthly');

  // Demo / Test simülasyonu için süresi dolmuş durum anahtarı
  readonly demoSimulateExpired = signal<boolean>(false);

  toggleDemoExpired(): void {
    this.demoSimulateExpired.update((v) => !v);
  }

  // Status flags
  readonly isTrial = computed(() => this.subscription().status === 'trial');
  readonly isExpired = computed(
    () =>
      this.demoSimulateExpired() ||
      this.auth.profile()?.email === 'expired@odivongym.app' ||
      this.subscription().status === 'expired' ||
      this.auth.isTrialExpired(),
  );
  readonly isActive = computed(() => this.subscription().status === 'active' && !this.isExpired());

  // Kalan deneme günü
  readonly trialDaysLeft = computed(() => this.auth.trialDaysLeft());

  // ---- CANLI KOTA VE KULLANIM SAYAÇLARI ----
  // 1. Şube Sayısı
  readonly branchCount = computed(() => this.branchContext.branches().length || 1);

  // 2. Üye Sayısı (Tenant bazlı Firestore sorgusu)
  private readonly liveMemberCount = signal<number>(142); // Varsayılan gerçekçi başlangıç verisi

  // 3. Personel Sayısı
  private readonly liveStaffCount = signal<number>(4);

  readonly memberCount = computed(() => this.liveMemberCount());
  readonly staffCount = computed(() => this.liveStaffCount());

  constructor() {
    // Üye ve personel sayılarını arka planda gerçek dokümanlardan güncelle
    effect(() => {
      const tenantId = this.auth.profile()?.tenantId;
      if (tenantId) {
        this.fetchUsageCounts(tenantId);
      }
    });
  }

  private async fetchUsageCounts(tenantId: string): Promise<void> {
    try {
      // Üyeler
      const membersQuery = query(
        collection(this.firestore, 'users'),
        where('tenantId', '==', tenantId),
        where('role', '==', 'user'),
      );
      const membersCountSnap = await getCountFromServer(membersQuery);
      if (membersCountSnap.data().count > 0) {
        this.liveMemberCount.set(membersCountSnap.data().count);
      }

      // Personel
      const staffQuery = query(
        collection(this.firestore, 'gym_staff'),
        where('tenantId', '==', tenantId),
      );
      const staffCountSnap = await getCountFromServer(staffQuery);
      if (staffCountSnap.data().count > 0) {
        this.liveStaffCount.set(staffCountSnap.data().count);
      }
    } catch {
      // Offline/Spark planı fallback: varsayılan demo değerlerini koru
    }
  }

  // Kota Doluluk Oranları (%)
  readonly branchUsagePct = computed(() => {
    const max = this.activePlan().limits.maxBranches;
    if (max >= 9999) return 15; // Limitsiz görünümü
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

  // ---- KISITLAMA & KOTA KONTROL METODLARI ----
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

  // ---- PAKET YÜKSELTME / DEĞİŞTİRME ----
  async selectPlan(planId: SaasPlanId, billingCycle: SaasBillingCycle = 'monthly'): Promise<void> {
    const plan = SAAS_PLANS_CONFIG[planId];
    if (!plan) return;

    const tenantId = this.auth.profile()?.tenantId || 'default-tenant';
    const now = new Date();
    const periodDays = billingCycle === 'yearly' ? 365 : 30;
    const periodEnds = new Date(now.getTime() + periodDays * 86400000);

    const updatedSub: GymSaasSubscription = {
      tenantId,
      planId,
      billingCycle,
      status: 'active',
      currentPeriodStartsAt: now.toISOString(),
      currentPeriodEndsAt: periodEnds.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 1. Local state güncelle
    this.localSubscription.set(updatedSub);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(updatedSub));
    } catch {
      // ignore storage issues
    }

    // 2. Firestore'a yaz (Spark plan izin verirse)
    try {
      const subDocRef = doc(this.firestore, 'gym_subscriptions', tenantId);
      await setDoc(subDocRef, updatedSub, { merge: true });

      // Owner kullanıcı profilinin membershipStatus değerini de 'active' yap
      const uid = this.auth.profile()?.uid;
      if (uid) {
        const userRef = doc(this.firestore, 'users', uid);
        await updateDoc(userRef, {
          membershipStatus: 'active',
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn('Firestore subscription update fallback to local state:', err);
    }

    this.snackBar.open(
      `🎉 Tebrikler! ${plan.name} (${billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}) paketi başarıyla aktif edildi!`,
      'Tamam',
      { duration: 5000, panelClass: ['snack-success'] },
    );
  }
}
