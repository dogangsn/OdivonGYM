import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';

type Accent = 'primary' | 'sky' | 'emerald' | 'amber' | 'purple';

interface StatCard {
  icon: string;
  accent: Accent;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}

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

  protected readonly accentClasses = ACCENT_CLASSES;

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

  protected readonly statCards = computed<StatCard[]>(() => {
    this.language.current();
    const isActive = this.auth.membershipStatus() === 'active';
    return [
      {
        icon: 'bolt',
        accent: 'primary',
        label: this.t(isActive ? 'dashboard.stat.membershipLabel' : 'dashboard.stat.trialLabel'),
        value: this.transloco.translate('dashboard.stat.daysValue', { days: this.auth.trialDaysLeft() }),
        hint: this.t(isActive ? 'dashboard.stat.membershipActiveHint' : 'dashboard.stat.trialHint'),
        highlight: true,
      },
      {
        icon: 'wallet',
        accent: 'sky',
        label: this.t('dashboard.stat.walletLabel'),
        value: `₺${(this.auth.profile()?.walletBalance ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        hint: this.t('dashboard.stat.walletHint'),
      },
      {
        icon: 'shield-check',
        accent: 'emerald',
        label: this.t('dashboard.stat.statusLabel'),
        value: this.t(isActive ? 'dashboard.stat.statusActive' : 'dashboard.stat.statusTrial'),
        hint: this.t('dashboard.stat.statusHint'),
      },
      {
        icon: 'fire',
        accent: 'amber',
        label: this.t('dashboard.stat.todayWorkoutLabel'),
        value: this.t('dashboard.stat.notPlanned'),
        hint: this.t('dashboard.stat.todayWorkoutHint'),
      },
      {
        icon: 'calendar-days',
        accent: 'purple',
        label: this.t('dashboard.stat.nextAppointmentLabel'),
        value: this.t('dashboard.stat.noAppointment'),
        hint: this.t('dashboard.stat.nextAppointmentHint'),
      },
    ];
  });

  protected readonly upcomingCards = computed<QuickCard[]>(() => {
    this.language.current();
    return [
      { icon: 'qr-code', accent: 'primary', title: this.t('dashboard.quick.qrTitle'), desc: this.t('dashboard.quick.qrDesc') },
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

  private t(key: string): string {
    return this.transloco.translate(key);
  }

  notifyComingSoon(title: string): void {
    this.snackBar.open(this.transloco.translate('dashboard.comingSoonToast', { title }), this.t('common.close'), {
      duration: 2500,
    });
  }
}
