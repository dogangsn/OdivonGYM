import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
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
import { MemberAccountService } from '../../../core/services/member-account.service';
import { PermissionService } from '../../../core/services/permission.service';
import { formatMoney, toJsDate } from '../../../shared/ui/ui-utils';
import { UserProfile } from '../../../core/models/user-profile.model';
import { ShopSale } from '../../../core/models/shop-product.model';
import { AccessLog } from '../../../core/models/access-log.model';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';
import { MUSCLE_GROUP_LABELS, MuscleGroup } from '../../../core/models/gym-equipment.model';
import { DashboardSummary, GymReportsApi } from '../../../core/api/gym-reports.api';
import { MeasurementsService } from '../../measurements/measurements.service';
import { BarDatum, DonutSlice, LineSeries, OdvBarChart, OdvDonutChart, OdvLineChart } from '../../../shared/charts/odv-charts';

const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  trial: 'DENEME',
  expired: 'SÜRESİ DOLDU',
  cancelled: 'İPTAL',
};

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

function weekday(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' });
}

function longDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'short' });
}

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
  imports: [RouterLink, MatIconModule, TranslocoPipe, OdvBarChart, OdvLineChart, OdvDonutChart],
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
  private readonly account = inject(MemberAccountService);
  private readonly permissions = inject(PermissionService);

  protected readonly accentClasses = ACCENT_CLASSES;
  protected readonly money = formatMoney;

  // Rol: üye ana sayfası kişisel kartları, personel ana sayfası salon özetini gösterir. Her rol
  // yalnız MainApi izninin yettiği veriyi ister (aksi halde 403 ve "yetkiniz yok" uyarısı çıkar).
  protected readonly isMember = this.auth.profile()?.role === 'user';
  protected readonly isStaff = !this.isMember;
  /** Satış (shop:view) ve turnike (accessControl:view): varsayılan rollerde yönetici ve resepsiyon. */
  protected readonly canSeeSales = signal(this.isStaff && this.permissions.can('shop'));
  protected readonly canSeeAccess = signal(this.isStaff && this.permissions.can('accessControl'));
  private readonly canSeeMembers = this.isStaff && this.permissions.can('members');

  // Data signals
  private readonly waterLogs = toSignal(this.onlyIf(this.isMember, () => this.waterService.watchLogs()), { initialValue: [] });
  private readonly workoutPlans = toSignal(this.onlyIf(this.isMember, () => this.workoutService.watchPlans()), { initialValue: [] });
  protected readonly allMembers = toSignal(this.onlyIf(this.canSeeMembers, () => this.membersService.watchMembers()), {
    initialValue: [] as UserProfile[],
  });
  protected readonly allSales = toSignal(this.onlyIf(this.canSeeSales(), () => this.shopService.watchSales()), {
    initialValue: [] as ShopSale[],
  });
  protected readonly allAccessLogs = toSignal(this.onlyIf(this.canSeeAccess(), () => this.accessService.watchLogs()), {
    initialValue: [] as AccessLog[],
  });

  private readonly measurementsService = inject(MeasurementsService);
  private readonly reportsApi = inject(GymReportsApi);
  private readonly measurements = toSignal(this.onlyIf(this.isMember, () => this.measurementsService.watchMeasurements()), {
    initialValue: [] as BodyMeasurement[],
  });
  /** Personel grafikleri tek istekte; her bölüm yalnız izin varsa dolu gelir (yoksa null, istek 403 vermez). */
  protected readonly summary = toSignal<DashboardSummary | null>(
    this.isStaff ? this.reportsApi.dashboard() : of(null),
    { initialValue: null },
  );

  protected readonly money0 = (value: number) =>
    value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  protected readonly litres = (value: number) => `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} L`;
  protected readonly kg = (value: number) => `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`;

  // ---- Personel grafikleri ----
  protected readonly checkInBars = computed<BarDatum[]>(() =>
    (this.summary()?.checkIns ?? []).map((d) => ({ label: weekday(d.day), hint: longDay(d.day), value: d.count })),
  );
  protected readonly salesBars = computed<BarDatum[]>(() =>
    (this.summary()?.sales ?? []).map((d) => ({ label: weekday(d.day), hint: `${longDay(d.day)} (${d.count} satış)`, value: d.amount })),
  );
  protected readonly memberSlices = computed<DonutSlice[]>(() => {
    const m = this.summary()?.members;
    if (!m) return [];
    return [
      { label: 'Aktif', value: m.active, colorIndex: 0 },
      { label: '7 gün içinde bitiyor', value: m.expiringSoon, colorIndex: 3 },
      { label: 'Süresi dolmuş', value: m.expired, colorIndex: 1 },
      { label: 'Deneme', value: m.trial, colorIndex: 2 },
      { label: 'İptal', value: m.cancelled, colorIndex: 6 },
    ];
  });
  protected readonly financeLabels = computed(() => (this.summary()?.finance ?? []).map((m) => monthLabel(m.month)));
  protected readonly financeSeries = computed<LineSeries[]>(() => {
    const finance = this.summary()?.finance ?? [];
    return [
      { name: 'Gelir', values: finance.map((m) => m.income), colorIndex: 0 },
      { name: 'Gider', values: finance.map((m) => m.expense), colorIndex: 1 },
    ];
  });

  // ---- Üye grafikleri ----
  /** Son 7 günün su tüketimi (litre); birim dönüşümü su ekranıyla aynı. */
  protected readonly waterBars = computed<BarDatum[]>(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const totals = new Map(days.map((d) => [d.toDateString(), 0]));
    for (const log of this.waterLogs()) {
      const date = toJsDate(log.date);
      if (!date || !totals.has(date.toDateString())) continue;
      const ml = log.unit === 'liter' ? log.amount * 1000 : log.unit === 'cup' ? log.amount * 250 : log.unit === 'bottle' ? log.amount * 500 : log.amount;
      totals.set(date.toDateString(), (totals.get(date.toDateString()) ?? 0) + ml);
    }
    return days.map((d) => ({
      label: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
      hint: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
      value: Math.round(((totals.get(d.toDateString()) ?? 0) / 1000) * 10) / 10,
    }));
  });

  /** Kilo ölçümlerinin son 8 tanesi, eskiden yeniye. */
  private readonly weightPoints = computed(() =>
    this.measurements()
      .filter((m) => typeof m.weight === 'number' && m.weight > 0)
      .map((m) => ({ date: toJsDate(m.date), weight: m.weight as number }))
      .filter((m): m is { date: Date; weight: number } => !!m.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-8),
  );
  protected readonly weightLabels = computed(() =>
    this.weightPoints().map((p) => p.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })),
  );
  protected readonly weightSeries = computed<LineSeries[]>(() => [
    { name: 'Kilo', values: this.weightPoints().map((p) => p.weight), colorIndex: 0 },
  ]);
  protected readonly weightChange = computed(() => {
    const points = this.weightPoints();
    if (points.length < 2) return null;
    return Math.round((points[points.length - 1].weight - points[0].weight) * 10) / 10;
  });

  /** Aktif programdaki egzersizlerin kas grubuna dağılımı. */
  protected readonly muscleSlices = computed<DonutSlice[]>(() => {
    const plans = this.workoutPlans();
    const active = plans.find((p) => p.status === 'active') ?? plans[0];
    // Renk kas grubuna sabit bağlı (sıralamaya göre değişmez); bilinmeyenler "Diğer" (8. renk).
    const groups = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
    const counts = new Map<number, number>();
    for (const exercise of active?.exercises ?? []) {
      const index = exercise.muscleGroup ? groups.indexOf(exercise.muscleGroup as MuscleGroup) : -1;
      const key = index >= 0 && index < 7 ? index : 7;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([index, value]) => ({ label: index < 7 ? MUSCLE_GROUP_LABELS[groups[index]] : 'Diğer', value, colorIndex: index }));
  });

  protected sumOf(bars: BarDatum[]): number {
    return Math.round(bars.reduce((sum, bar) => sum + bar.value, 0) * 100) / 100;
  }

  private onlyIf<T>(allowed: boolean, load: () => Observable<T[]>): Observable<T[]> {
    return allowed ? load() : of([] as T[]);
  }

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
  /** Üyelik özeti `/gym/mobile/me`den gelir (`/identity/me` salon denemesini taşır, üyeliği değil). */
  private readonly membership = computed(() => this.account.me()?.membership ?? null);

  protected readonly isMembershipActive = computed(() => {
    const membership = this.membership();
    return membership ? membership.status === 'active' : this.auth.membershipStatus() === 'active';
  });

  protected readonly membershipTitle = computed(() => {
    if (this.isMembershipActive()) return 'Aktif Üyelik';
    return this.membership() ? 'Üyelik Durumu' : 'Ücretsiz Deneme';
  });

  protected readonly membershipValue = computed(() => {
    if (this.isMembershipActive()) return 'AKTİF';
    const membership = this.membership();
    if (membership) return MEMBERSHIP_STATUS_LABEL[membership.status] ?? 'PASİF';
    const days = this.auth.trialDaysLeft();
    return `${days} GÜN`;
  });

  protected readonly membershipSubText = computed(() => {
    const membership = this.membership();
    if (membership) {
      if (membership.daysLeft != null) return `${membership.type ?? 'Üyelik'} · ${membership.daysLeft} gün kaldı`;
      return membership.type ?? 'Üyelik';
    }
    if (this.isMembershipActive()) return 'Tam Erişim Paketi';
    return `${this.auth.trialDaysLeft()} Gün Kalan Deneme`;
  });

  protected readonly membershipEndDate = computed(() => {
    const membership = this.membership();
    if (membership) {
      return membership.endsAt
        ? new Date(membership.endsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
        : 'Süresiz';
    }
    const profile = this.auth.profile();
    const date = this.isMembershipActive() ? profile?.membershipEndsAt : profile?.trialEndsAt;
    if (!date) return 'Süresiz';
    return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  });

  protected readonly walletFormatted = computed(() => {
    const bal = this.account.me()?.walletBalance ?? this.auth.profile()?.walletBalance ?? 0;
    return bal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  // Water calculations
  protected readonly todayWaterMetrics = computed(() => {
    const logs = this.waterLogs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logs.filter((log) => {
      const d = toJsDate(log.date);
      if (!d) return false;
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
