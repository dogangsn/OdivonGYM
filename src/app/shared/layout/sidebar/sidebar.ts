import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
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

const ADMIN_OPERATIONAL_GROUPS: NavGroup[] = [
  {
    titleKey: 'sidebar.groupOperations',
    items: [
      { icon: 'space_dashboard', labelKey: 'sidebar.adminOverview', link: '/admin/overview' },
      { icon: 'nfc', labelKey: 'sidebar.adminAccessControl', link: '/admin/access-control' },
      { icon: 'groups', labelKey: 'sidebar.adminMembers', link: '/admin/members' },
      { icon: 'auto_awesome', labelKey: 'sidebar.adminWizard', link: '/admin/wizard' },
    ],
  },
  {
    titleKey: 'sidebar.groupFinance',
    items: [
      { icon: 'account_balance', labelKey: 'sidebar.adminAccounting', link: '/admin/accounting' },
      { icon: 'point_of_sale', labelKey: 'sidebar.adminShop', link: '/admin/shop' },
      { icon: 'sell', labelKey: 'sidebar.adminPackages', link: '/admin/packages' },
      { icon: 'campaign', labelKey: 'sidebar.adminCampaigns', link: '/admin/campaigns' },
      { icon: 'local_shipping', labelKey: 'sidebar.adminSuppliers', link: '/admin/suppliers' },
      { icon: 'receipt_long', labelKey: 'sidebar.adminEInvoice', link: '/admin/e-invoice' },
    ],
  },
  {
    titleKey: 'sidebar.groupClubPrograms',
    items: [
      { icon: 'sports_martial_arts', labelKey: 'sidebar.adminDisciplines', link: '/admin/disciplines' },
      { icon: 'calendar_month', labelKey: 'sidebar.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.ptAppointments', link: '/appointments' },
    ],
  },
  {
    titleKey: 'sidebar.groupSettings',
    items: [
      { icon: 'badge', labelKey: 'sidebar.adminStaff', link: '/admin/staff' },
      { icon: 'store', labelKey: 'sidebar.adminBranches', link: '/admin/branches' },
      { icon: 'business', labelKey: 'sidebar.adminGymInfo', link: '/admin/gym-info' },
      { icon: 'card_membership', labelKey: 'sidebar.adminSubscription', link: '/admin/subscription' },
    ],
  },
];

const MEMBER_GROUPS: NavGroup[] = [
  {
    titleKey: 'sidebar.groupGeneral',
    items: [
      { icon: 'space_dashboard', labelKey: 'sidebar.dashboard', link: '/dashboard' },
    ],
  },
  {
    titleKey: 'sidebar.groupMemberFitness',
    items: [
      { icon: 'sports_gymnastics', labelKey: 'sidebar.workoutPlan', link: '/workout' },
      { icon: 'calendar_month', labelKey: 'sidebar.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.ptAppointments', link: '/appointments' },
    ],
  },
  {
    titleKey: 'sidebar.groupMemberHealth',
    items: [
      { icon: 'monitor_weight', labelKey: 'sidebar.bodyMeasurements', link: '/measurements' },
      { icon: 'water_drop', labelKey: 'sidebar.waterTracker', link: '/water' },
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
  protected readonly permissions = inject(PermissionService);

  /** Masaüstünde ikon-şeridine daraltma; dar ekranda overlay açık/kapalı. */
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);

  readonly collapseToggle = output<void>();
  readonly closeMobile = output<void>();
  readonly logOutRequested = output<void>();

  protected readonly groups = computed<NavGroup[]>(() => {
    const role = this.permissions.currentRole();
    if (role === 'user') {
      return MEMBER_GROUPS;
    }

    if (role === 'owner' || role === 'admin') {
      return ADMIN_OPERATIONAL_GROUPS;
    }

    // Antrenör veya Resepsiyon: yetkilerine göre filtrelenmiş gruplar
    return ADMIN_OPERATIONAL_GROUPS.map((group) => {
      const allowedItems = group.items.filter((item) =>
        this.permissions.canAccessRoute(item.link),
      );
      return {
        ...group,
        items: allowedItems,
      };
    }).filter((group) => group.items.length > 0);
  });
}
