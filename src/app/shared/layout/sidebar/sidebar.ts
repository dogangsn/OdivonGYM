import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { LogoMark } from '../../components/logo-mark/logo-mark';

export interface NavItem {
  icon: string;
  labelKey: string;
  link: string;
  badge?: string;
  badgeClass?: string;
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const ADMIN_OPERATIONAL_GROUPS: NavGroup[] = [
  {
    titleKey: 'Genel',
    items: [
      { icon: 'dashboard', labelKey: 'Dashboard', link: '/dashboard' },
      { icon: 'space_dashboard', labelKey: 'Salon Özeti', link: '/admin/overview' },
    ],
  },
  {
    titleKey: 'Kulüp & Sporcular',
    items: [
      { icon: 'groups', labelKey: 'Üye Kayıtları', link: '/admin/members' },
      { icon: 'person_search', labelKey: 'Misafir Üyeler', link: '/admin/guest-members' },
      { icon: 'calendar_month', labelKey: 'Ders & Seans Takvimi', link: '/classes' },
      { icon: 'event_available', labelKey: 'PT Randevuları', link: '/appointments' },
      { icon: 'auto_awesome', labelKey: 'Eğitim Sihirbazı', link: '/admin/wizard' },
    ],
  },
  {
    titleKey: 'Kasa / POS',
    items: [
      { icon: 'point_of_sale', labelKey: 'Hızlı Kasa & POS', link: '/admin/pos', badge: 'Canlı', badgeClass: 'badge-emerald' },
    ],
  },
  {
    titleKey: 'Satış',
    items: [
      { icon: 'sell', labelKey: 'Üyelik Paketleri', link: '/admin/packages', badge: 'Yeni', badgeClass: 'badge-rose' },
      { icon: 'shopping_bag', labelKey: 'Paket & Market Satışı', link: '/admin/sales' },
      { icon: 'campaign', labelKey: 'Kampanyalar & İndirim', link: '/admin/campaigns' },
    ],
  },

  {
    titleKey: 'Ürün & Stok',
    items: [
      { icon: 'inventory_2', labelKey: 'Ürün & Stok Yönetimi', link: '/admin/products' },
      { icon: 'local_shipping', labelKey: 'Tedarikçiler', link: '/admin/suppliers' },
    ],
  },
  {
    titleKey: 'Finans',
    items: [
      { icon: 'account_balance', labelKey: 'Kasa & Muhasebe', link: '/admin/accounting' },
      { icon: 'receipt_long', labelKey: 'Fatura & E-Fatura', link: '/admin/e-invoice', badge: 'GİB', badgeClass: 'badge-teal' },
    ],
  },
  {
    titleKey: 'Raporlar',
    items: [
      { icon: 'analytics', labelKey: 'Satış & Kasa Raporları', link: '/admin/reports' },
    ],
  },
  {
    titleKey: 'Erişim Kontrolü',
    items: [
      { icon: 'nfc', labelKey: 'Turnike & Geçiş Kontrol', link: '/admin/access-control', badge: 'IoT', badgeClass: 'badge-purple' },
    ],
  },

  {
    titleKey: 'Tanımlar',
    items: [
      { icon: 'sports_martial_arts', labelKey: 'Branşlar & Donanım', link: '/admin/disciplines' },
      { icon: 'accessibility_new', labelKey: 'Kas Grupları & Egzersiz', link: '/admin/definitions' },
      { icon: 'inventory_2', labelKey: 'Stok & Ürün Kategorileri', link: '/admin/stock-categories' },

    ],
  },
  {
    titleKey: 'Ayarlar & Yönetim',
    items: [
      { icon: 'badge', labelKey: 'Personel & Eğitmenler', link: '/admin/staff' },
      { icon: 'store', labelKey: 'Şubeler', link: '/admin/branches' },
      { icon: 'business', labelKey: 'Salon Bilgileri', link: '/admin/gym-info' },
      { icon: 'card_membership', labelKey: 'SaaS Paket & Lisans', link: '/admin/subscription', badge: 'Plan', badgeClass: 'badge-purple' },
    ],
  },
];

const MEMBER_GROUPS: NavGroup[] = [
  {
    titleKey: 'Genel',
    items: [
      { icon: 'space_dashboard', labelKey: 'sidebar.dashboard', link: '/dashboard' },
    ],
  },
  {
    titleKey: 'Fitness & Antrenman',
    items: [
      { icon: 'sports_gymnastics', labelKey: 'sidebar.workoutPlan', link: '/workout' },
      { icon: 'calendar_month', labelKey: 'sidebar.classSchedule', link: '/classes' },
      { icon: 'event_available', labelKey: 'sidebar.ptAppointments', link: '/appointments' },
    ],
  },
  {
    titleKey: 'Sağlık & Gelişim',
    items: [
      { icon: 'monitor_weight', labelKey: 'sidebar.bodyMeasurements', link: '/measurements' },
      { icon: 'water_drop', labelKey: 'sidebar.waterTracker', link: '/water' },
    ],
  },
  {
    titleKey: 'Hesap & Cüzdan',
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

  protected readonly userInitials = computed(() => {
    const name = this.auth.profile()?.displayName || 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  protected readonly roleBadge = computed(() => {
    const role = this.auth.profile()?.role;
    if (role === 'owner' || role === 'admin') return 'Yönetici';
    if (role === 'trainer') return 'Antrenör';
    if (role === 'receptionist') return 'Resepsiyon';
    return 'Üye';
  });

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
