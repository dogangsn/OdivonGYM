import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/auth/auth.service';
import { LogoMark } from '../../components/logo-mark/logo-mark';
import { TrialBadge } from '../../components/trial-badge/trial-badge';

interface NavItem {
  icon: string;
  label: string;
  link: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const BASE_GROUPS: NavGroup[] = [
  { title: 'Genel', items: [{ icon: 'space_dashboard', label: 'Ana Sayfa', link: '/dashboard' }] },
  {
    title: 'Antrenman',
    items: [
      { icon: 'sports_gymnastics', label: 'Antrenman Programı', link: '/workout' },
      { icon: 'calendar_month', label: 'Ders Takvimi', link: '/classes' },
      { icon: 'event_available', label: 'PT Randevu', link: '/appointments' },
    ],
  },
  {
    title: 'Sağlık',
    items: [
      { icon: 'water_drop', label: 'Su Takibi', link: '/water' },
      { icon: 'monitor_weight', label: 'Vücut Ölçümleri', link: '/measurements' },
    ],
  },
  {
    title: 'Hesap',
    items: [
      { icon: 'account_balance_wallet', label: 'E-Cüzdan', link: '/wallet' },
      { icon: 'card_membership', label: 'Paketler', link: '/packages' },
      { icon: 'person', label: 'Profil & Ayarlar', link: '/profile' },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  title: 'Yönetim',
  items: [
    { icon: 'space_dashboard', label: 'Salon Durumu', link: '/admin/overview' },
    { icon: 'groups', label: 'Üye Kayıtları', link: '/admin/members' },
    { icon: 'store', label: 'Şubeler', link: '/admin/branches' },
    { icon: 'sell', label: 'Paket & Fiyatlandırma', link: '/admin/packages' },
    { icon: 'point_of_sale', label: 'Market Satışları', link: '/admin/shop' },
    { icon: 'account_balance', label: 'Muhasebe', link: '/admin/accounting' },
    { icon: 'nfc', label: 'Turnike Sistemi', link: '/admin/access-control' },
    { icon: 'business', label: 'Salon Bilgileri', link: '/admin/gym-info' },
  ],
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, MatMenuModule, LogoMark, TrialBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly auth = inject(AuthService);

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
