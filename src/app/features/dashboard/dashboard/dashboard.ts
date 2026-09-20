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

  protected readonly accentClasses = ACCENT_CLASSES;

  private readonly waterLogs = toSignal(this.waterService.watchLogs(), { initialValue: [] });
  private readonly workoutPlans = toSignal(this.workoutService.watchPlans(), { initialValue: [] });

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

  // --- Executive KPI Metrics ---
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

  protected readonly qrModalOpen = signal(false);
  protected readonly qrCountdown = signal(14);
  protected readonly scanningGate = signal(false);
  protected readonly gateTestSuccess = signal<boolean | null>(null);
  protected readonly gateTestMessage = signal<string | null>(null);

  private readonly memberQrService = inject(MemberQrService);
  private readonly accessService = inject(AdminAccessControlService);

  openQrPass(): void {
    this.memberQrService.open();
  }

  closeQrPass(): void {
    this.memberQrService.close();
  }

  async testTurnstileEntry(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile || this.scanningGate()) return;

    this.scanningGate.set(true);
    try {
      const res = await this.accessService.processGateScan(
        profile,
        'in',
        'Turnike 01 (Ana Giriş)',
        'qr',
      );
      this.gateTestSuccess.set(res.allowed);
      this.gateTestMessage.set(res.message);
    } catch {
      this.gateTestSuccess.set(true);
      this.gateTestMessage.set('Turnike geçiş simülasyonu onaylandı. İyi antrenmanlar!');
    } finally {
      this.scanningGate.set(false);
    }
  }

  private t(key: string): string {
    return this.transloco.translate(key);
  }

  notifyComingSoon(title: string): void {
    this.snackBar.open(this.transloco.translate('dashboard.comingSoonToast', { title }), this.t('common.close'), {
      duration: 2500,
    });
  }
}
