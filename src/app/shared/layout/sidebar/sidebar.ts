import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../components/logo-mark/logo-mark';
import { TrialBadge } from '../../components/trial-badge/trial-badge';

interface NavItem {
  icon: string;
  labelKey: string;
  link: string;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const BASE_GROUPS: NavGroup[] = [
  { titleKey: 'sidebar.groupGeneral', items: [{ icon: 'space_dashboard', labelKey: 'sidebar.dashboard', link: '/dashboard' }] },
  {
    titleKey: 'sidebar.groupWorkout',
    items: [
      { icon: 'sports_gymnastics', labelKey: 'sidebar.workoutPlan', link: '/workout' },
      { icon: 'calendar_month', labelKey: 'sidebar.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.ptAppointments', link: '/appointments' },
    ],
  },
  {
    titleKey: 'sidebar.groupHealth',
    items: [
      { icon: 'water_drop', labelKey: 'sidebar.waterTracker', link: '/water' },
      { icon: 'monitor_weight', labelKey: 'sidebar.bodyMeasurements', link: '/measurements' },
    ],
  },
  {
    titleKey: 'sidebar.groupAccount',
    items: [
      { icon: 'account_balance_wallet', labelKey: 'sidebar.wallet', link: '/wallet' },
      { icon: 'card_membership', labelKey: 'sidebar.packages', link: '/packages' },
      { icon: 'person', labelKey: 'sidebar.profile', link: '/profile' },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  titleKey: 'sidebar.groupManagement',
  items: [
    { icon: 'space_dashboard', labelKey: 'sidebar.adminOverview', link: '/admin/overview' },
    { icon: 'groups', labelKey: 'sidebar.adminMembers', link: '/admin/members' },
    { icon: 'store', labelKey: 'sidebar.adminBranches', link: '/admin/branches' },
    { icon: 'sell', labelKey: 'sidebar.adminPackages', link: '/admin/packages' },
    { icon: 'point_of_sale', labelKey: 'sidebar.adminShop', link: '/admin/shop' },
    { icon: 'account_balance', labelKey: 'sidebar.adminAccounting', link: '/admin/accounting' },
    { icon: 'nfc', labelKey: 'sidebar.adminAccessControl', link: '/admin/access-control' },
    { icon: 'business', labelKey: 'sidebar.adminGymInfo', link: '/admin/gym-info' },
  ],
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    LogoMark,
    TrialBadge,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
  protected readonly transloco = inject(TranslocoService);

  /** Masaüstünde ikon-şeridine daraltma; dar ekranda overlay açık/kapalı. */
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);

  readonly collapseToggle = output<void>();
  readonly closeMobile = output<void>();
  readonly logOutRequested = output<void>();

  protected readonly groups = computed<NavGroup[]>(() =>
    this.auth.profile()?.role === 'admin' ? [...BASE_GROUPS, ADMIN_GROUP] : BASE_GROUPS,
  );
}
