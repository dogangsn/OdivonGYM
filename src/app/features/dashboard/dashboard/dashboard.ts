import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { WaterService } from '../../water/water.service';
import { WorkoutService } from '../../workout/workout.service';
import { AdminAccessControlService } from '../../../admin/access-control/admin-access-control.service';
import { MemberQrService } from '../../../shared/components/member-qr-modal/member-qr.service';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AdminShopService } from '../../../admin/shop/admin-shop.service';
import { AlertService } from '../../../core/services/alert.service';
import { formatMoney } from '../../../shared/ui/ui-utils';
import { UserProfile } from '../../../core/models/user-profile.model';
import { ShopSale } from '../../../core/models/shop-product.model';
import { AccessLog } from '../../../core/models/access-log.model';

type Accent = 'primary' | 'sky' | 'emerald' | 'amber' | 'purple';

interface QuickCard {
  icon: string;
  accent: Accent;
  title: string;
  desc: string;
  link?: string;
}

const ACCENT_CLASSES: Record<Accent, string> = {
  primary: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
};

function isDateToday(dateInput: any): boolean {
  if (!dateInput) return false;
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isDateExpiringSoonOrToday(dateInput: any): boolean {
  if (!dateInput) return false;
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  // Expired in last 24h or expiring in next 48h
  return diffHours >= -24 && diffHours <= 48;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly waterService = inject(WaterService);
  private readonly workoutService = inject(WorkoutService);
  private readonly membersService = inject(AdminMembersService);
  private readonly shopService = inject(AdminShopService);
  private readonly accessService = inject(AdminAccessControlService);
  private readonly memberQrService = inject(MemberQrService);
  private readonly alertService = inject(AlertService);

  protected readonly accentClasses = ACCENT_CLASSES;
  protected readonly money = formatMoney;

  // Role Checks
  protected readonly isStaffOrTrainer = computed(() => {
    const role = this.auth.profile()?.role;
    return role === 'admin' || role === 'owner' || role === 'trainer';
  });

  // Data signals
  private readonly waterLogs = toSignal(this.waterService.watchLogs(), { initialValue: [] });
  private readonly workoutPlans = toSignal(this.workoutService.watchPlans(), { initialValue: [] });
  protected readonly allMembers = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  protected readonly allSales = toSignal(this.shopService.watchSales(), { initialValue: [] as ShopSale[] });
  protected readonly allAccessLogs = toSignal(this.accessService.watchLogs(), { initialValue: [] as AccessLog[] });

  protected readonly firstName = computed(
    () => this.auth.profile()?.displayName?.split(' ')[0] ?? this.t('dashboard.defaultMemberName'),
  );

  protected readonly greeting = computed(() => {
    this.language.current();
    const hour = new Date().getHours();
    if (hour < 6) return this.t('dashboard.greetingNight');
    if (hour < 12) return this.t('dashboard.greetingMorning');
    if (hour < 18) return this.t('dashboard.greetingDay');
    return this.t('dashboard.greetingEvening');
  });

  // ========================================================
  // SECTION 8: 4 YÖNETİCİ & CANLI OPERASYON WIDGET HESAPLAMALARI
  // ========================================================

  // 1. Bugün abonelik yapan ve yenileyen kişiler
  protected readonly todayNewAndRenewedMembers = computed(() => {
    const list = this.allMembers();
    return list.filter((m) => isDateToday(m.createdAt) || (m.updatedAt && isDateToday(m.updatedAt)));
  });

  // 2. Bugün yapılan satışlar özeti
  protected readonly todaySales = computed(() => {
    const sales = this.allSales();
    return sales.filter((s) => isDateToday(s.saleDate));
  });

  protected readonly todaySalesTotalAmount = computed(() => {
    return this.todaySales().reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  });

  // 3. Bugün aboneliği yenileme zamanı gelmiş kişiler
  protected readonly todayExpiringMembers = computed(() => {
    const list = this.allMembers();
    return list.filter((m) => isDateExpiringSoonOrToday(m.membershipEndsAt));
  });

  // 4. Günlük gelen Kadın / Erkek üye istatistikleri
  protected readonly todayGenderStats = computed(() => {
    const logs = this.allAccessLogs();
    const todayEntries = logs.filter(
      (l) => l.direction === 'in' && l.status === 'granted' && isDateToday(l.timestamp),
    );

    const membersMap = new Map<string, UserProfile>();
    for (const m of this.allMembers()) {
      membersMap.set(m.uid, m);
    }

    let female = 0;
    let male = 0;

    for (const log of todayEntries) {
      if (log.userId && membersMap.has(log.userId)) {
        const mem = membersMap.get(log.userId);
        if (mem?.gender === 'female') {
          female++;
        } else if (mem?.gender === 'male') {
          male++;
        }
      }
    }

    const total = todayEntries.length;
    const femalePercent = total > 0 ? Math.round((female / total) * 100) : 0;
    const malePercent = total > 0 ? Math.round((male / total) * 100) : 0;

    return {
      total,
      female,
      male,
      femalePercent,
      malePercent,
    };
  });

  // ========================================================
  // BİREYSEL ÜYE METRİKLERİ (Member Profile View)
  // ========================================================
  protected readonly isMembershipActive = computed(() => this.auth.membershipStatus() === 'active');

  protected readonly membershipTitle = computed(() =>
    this.isMembershipActive() ? 'Aktif Üyelik' : 'Ücretsiz Deneme',
  );

  protected readonly membershipValue = computed(() => {
    if (this.isMembershipActive()) return 'AKTİF';
    const days = this.auth.trialDaysLeft();
    return `${days} GÜN`;
  });

  protected readonly membershipSubText = computed(() => {
    if (this.isMembershipActive()) return 'Tam Erişim Paketi';
    return `${this.auth.trialDaysLeft()} Gün Kalan Deneme`;
  });

  protected readonly membershipEndDate = computed(() => {
    const profile = this.auth.profile();
    const date = this.isMembershipActive() ? profile?.membershipEndsAt : profile?.trialEndsAt;
    if (!date) return 'Süresiz';
    return date.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  });

  protected readonly walletFormatted = computed(() => {
    const bal = this.auth.profile()?.walletBalance ?? 0;
    return bal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  // Water calculations
  protected readonly todayWaterMetrics = computed(() => {
    const logs = this.waterLogs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logs.filter((log) => {
      const d = log.date.toDate();
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    let totalMl = 0;
    for (const log of todayLogs) {
      const ml =
        log.unit === 'liter'
          ? log.amount * 1000
          : log.unit === 'cup'
            ? log.amount * 250
            : log.unit === 'bottle'
              ? log.amount * 500
              : log.amount;
      totalMl += ml;
    }

    const litres = (totalMl / 1000).toFixed(1);
    const goalMl = 2500;
    const percent = Math.min(100, Math.round((totalMl / goalMl) * 100));

    return {
      litres,
      count: todayLogs.length,
      percent,
      goalLitres: '2.5',
    };
  });

  // Workout calculations
  protected readonly workoutMetrics = computed(() => {
    const plans = this.workoutPlans();
    const active = plans.find((p) => p.status === 'active') ?? plans[0];
    const exerciseCount = active?.exercises?.length ?? 0;
    return {
      totalPlans: plans.length,
      activeTitle: active?.title ?? 'Plan Belirlenmedi',
      exerciseCount,
      hasActive: !!active,
    };
  });

  protected readonly upcomingCards = computed<QuickCard[]>(() => {
    this.language.current();
    return [
      {
        icon: 'qr-code',
        accent: 'primary',
        title: this.t('dashboard.quick.qrTitle'),
        desc: this.t('dashboard.quick.qrDesc'),
      },
      {
        icon: 'wallet',
        accent: 'sky',
        title: this.t('dashboard.quick.walletTitle'),
        desc: this.t('dashboard.quick.walletDesc'),
        link: '/wallet',
      },
      {
        icon: 'calendar-days',
        accent: 'purple',
        title: this.t('dashboard.quick.classesTitle'),
        desc: this.t('dashboard.quick.classesDesc'),
        link: '/classes',
      },
      {
        icon: 'fire',
        accent: 'amber',
        title: this.t('dashboard.quick.workoutTitle'),
        desc: this.t('dashboard.quick.workoutDesc'),
        link: '/workout',
      },
      {
        icon: 'check-circle',
        accent: 'emerald',
        title: this.t('dashboard.quick.appointmentsTitle'),
        desc: this.t('dashboard.quick.appointmentsDesc'),
        link: '/appointments',
      },
      {
        icon: 'beaker',
        accent: 'sky',
        title: this.t('dashboard.quick.waterTitle'),
        desc: this.t('dashboard.quick.waterDesc'),
        link: '/water',
      },
      {
        icon: 'scale',
        accent: 'primary',
        title: this.t('dashboard.quick.measurementsTitle'),
        desc: this.t('dashboard.quick.measurementsDesc'),
        link: '/measurements',
      },
    ];
  });

  openQrPass(): void {
    this.memberQrService.open();
  }

  notifyRenewal(member: UserProfile): void {
    this.alertService.toastSuccess(`${member.displayName || member.email} için yenileme hatırlatması hazırlandı.`);
  }

  notifyComingSoon(title: string): void {
    this.alertService.toastInfo(`${title} modülü yakında hizmete girecektir.`);
  }

  isMemberCreatedToday(member: UserProfile): boolean {
    return isDateToday(member.createdAt);
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }

  formatDate(ts: any): string {
    if (!ts) return 'Bugün';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
}
