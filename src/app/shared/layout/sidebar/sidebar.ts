import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { SaasSubscriptionService } from '../../../core/services/saas-subscription.service';
import { LogoMark } from '../../components/logo-mark/logo-mark';

export interface NavItem {
  icon: string;
  labelKey: string;
  link: string;
  badge?: string;
  badgeKey?: string;
  badgeParams?: Record<string, unknown>;
  badgeClass?: string;
  requiresActiveSaas?: boolean;
  isLocked?: boolean;
  isHighlighted?: boolean;
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const ADMIN_OPERATIONAL_GROUPS: NavGroup[] = [
  {
    titleKey: 'sidebar.groups.general',
    items: [
      { icon: 'dashboard', labelKey: 'sidebar.items.dashboard', link: '/dashboard' },
      { icon: 'space_dashboard', labelKey: 'sidebar.items.adminOverview', link: '/admin/overview' },
    ],
  },
  {
    titleKey: 'sidebar.groups.club',
    items: [
      { icon: 'groups', labelKey: 'sidebar.items.adminMembers', link: '/admin/members' },
      { icon: 'card_membership', labelKey: 'sidebar.items.adminSubscriptions', link: '/admin/subscriptions', badgeKey: 'sidebar.badges.renewal', badgeClass: 'badge-emerald' },
      { icon: 'person_search', labelKey: 'sidebar.items.adminGuestMembers', link: '/admin/guest-members' },
      { icon: 'calendar_month', labelKey: 'sidebar.items.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.items.ptAppointments', link: '/appointments' },
      { icon: 'auto_awesome', labelKey: 'sidebar.items.adminWizard', link: '/admin/wizard' },
    ],
  },
  {
    titleKey: 'sidebar.groups.pos',
    items: [
      {
        icon: 'point_of_sale',
        labelKey: 'sidebar.items.adminPos',
        link: '/admin/pos',
        badgeKey: 'sidebar.badges.live',
        badgeClass: 'badge-emerald',
        requiresActiveSaas: true,
      },
    ],
  },
  {
    titleKey: 'sidebar.groups.sales',
    items: [
      { icon: 'sell', labelKey: 'sidebar.items.adminPackages', link: '/admin/packages', badgeKey: 'sidebar.badges.new', badgeClass: 'badge-rose' },
      { icon: 'shopping_bag', labelKey: 'sidebar.items.adminSales', link: '/admin/sales', requiresActiveSaas: true },
      { icon: 'campaign', labelKey: 'sidebar.items.adminCampaigns', link: '/admin/campaigns', requiresActiveSaas: true },
    ],
  },
  {
    titleKey: 'sidebar.groups.stock',
    items: [
      { icon: 'inventory_2', labelKey: 'sidebar.items.adminProducts', link: '/admin/products' },
      { icon: 'local_shipping', labelKey: 'sidebar.items.adminSuppliers', link: '/admin/suppliers' },
    ],
  },
  {
    titleKey: 'sidebar.groups.finance',
    items: [
      { icon: 'account_balance', labelKey: 'sidebar.items.adminAccounting', link: '/admin/accounting' },
      { icon: 'receipt_long', labelKey: 'sidebar.items.adminEInvoice', link: '/admin/e-invoice', badgeKey: 'sidebar.badges.gib', badgeClass: 'badge-teal', requiresActiveSaas: true },
    ],
  },
  {
    titleKey: 'sidebar.groups.reports',
    items: [
      { icon: 'analytics', labelKey: 'sidebar.items.adminReports', link: '/admin/reports' },
    ],
  },
  {
    titleKey: 'sidebar.groups.access',
    items: [
      {
        icon: 'nfc',
        labelKey: 'sidebar.items.adminAccessControl',
        link: '/admin/access-control',
        badgeKey: 'sidebar.badges.iot',
        badgeClass: 'badge-purple',
        requiresActiveSaas: true,
      },
    ],
  },
  {
    titleKey: 'sidebar.groups.definitions',
    items: [
      { icon: 'sports_martial_arts', labelKey: 'sidebar.items.adminDisciplines', link: '/admin/disciplines' },
      { icon: 'accessibility_new', labelKey: 'sidebar.items.adminDefinitions', link: '/admin/definitions' },
      { icon: 'inventory_2', labelKey: 'sidebar.items.adminStockCategories', link: '/admin/stock-categories' },
    ],
  },
  {
    titleKey: 'sidebar.groups.management',
    items: [
      { icon: 'badge', labelKey: 'sidebar.items.adminStaff', link: '/admin/staff' },
      { icon: 'store', labelKey: 'sidebar.items.adminBranches', link: '/admin/branches' },
      { icon: 'business', labelKey: 'sidebar.items.adminGymInfo', link: '/admin/gym-info' },
      { icon: 'card_membership', labelKey: 'sidebar.items.adminSubscription', link: '/admin/subscription', badgeKey: 'sidebar.badges.plan', badgeClass: 'badge-purple' },
    ],
  },
];

const MEMBER_GROUPS: NavGroup[] = [
  {
    titleKey: 'sidebar.groups.general',
    items: [
      { icon: 'space_dashboard', labelKey: 'sidebar.items.dashboard', link: '/dashboard' },
    ],
  },
  {
    titleKey: 'sidebar.groups.fitness',
    items: [
      { icon: 'sports_gymnastics', labelKey: 'sidebar.items.workoutPlan', link: '/workout' },
      { icon: 'calendar_month', labelKey: 'sidebar.items.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.items.ptAppointments', link: '/appointments' },
    ],
  },
  {
    titleKey: 'sidebar.groups.health',
    items: [
      { icon: 'monitor_weight', labelKey: 'sidebar.items.bodyMeasurements', link: '/measurements' },
      { icon: 'water_drop', labelKey: 'sidebar.items.waterTracker', link: '/water' },
    ],
  },
  {
    titleKey: 'sidebar.groups.account',
    items: [
      { icon: 'account_balance_wallet', labelKey: 'sidebar.items.wallet', link: '/wallet' },
      { icon: 'card_membership', labelKey: 'sidebar.items.packages', link: '/packages' },
      { icon: 'person', labelKey: 'sidebar.items.profile', link: '/profile' },
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
  protected readonly saasSub = inject(SaasSubscriptionService);

  /** Masaüstünde ikon-şeridine daraltma; dar ekranda overlay açık/kapalı. */
  readonly collapsed = input(false);
  readonly mobileOpen = input(false);

  readonly collapseToggle = output<void>();
  readonly closeMobile = output<void>();
  readonly logOutRequested = output<void>();

  protected readonly isExpired = computed(() => this.saasSub.isExpired());

  protected readonly userInitials = computed(() => {
    const name = this.auth.profile()?.displayName || 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  protected readonly roleBadgeKey = computed(() => {
    const role = this.auth.profile()?.role;
    if (role === 'owner') return 'sidebar.roles.owner';
    if (role === 'admin') return 'sidebar.roles.admin';
    if (role === 'trainer') return 'sidebar.roles.trainer';
    if (role === 'receptionist') return 'sidebar.roles.receptionist';
    return 'sidebar.roles.user';
  });

  protected readonly groups = computed<NavGroup[]>(() => {
    const role = this.permissions.currentRole();
    const expired = this.isExpired();

    if (role === 'user') {
      return MEMBER_GROUPS;
    }

    const baseGroups = ADMIN_OPERATIONAL_GROUPS;

    return baseGroups.map((group) => {
      let allowedItems = group.items;
      if (role !== 'owner' && role !== 'admin') {
        allowedItems = allowedItems.filter((item) => this.permissions.canAccessRoute(item.link));
      }

      // Expired SaaS durumu için item'ları dönüştür
      const mappedItems = allowedItems.map((item) => {
        if (expired && item.requiresActiveSaas) {
          return {
            ...item,
            isLocked: true,
            badgeKey: 'sidebar.badges.locked',
            badgeClass: 'badge-rose',
          };
        }
        if (item.link === '/admin/subscription') {
          if (expired) {
            return {
              ...item,
              badgeKey: 'sidebar.badges.expiredRenew',
              badgeClass: 'badge-rose animate-pulse',
              isHighlighted: true,
            };
          }
          if (this.saasSub.isTrial()) {
            return {
              ...item,
              badgeKey: 'sidebar.badges.daysLeft',
              badgeParams: { days: this.saasSub.trialDaysLeft() },
              badgeClass: 'badge-amber',
            };
          }
        }
        return item;
      });

      return {
        ...group,
        items: mappedItems,
      };
    }).filter((group) => group.items.length > 0);
  });
}
