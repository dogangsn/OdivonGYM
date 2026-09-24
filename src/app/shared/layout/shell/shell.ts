import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService, LANGUAGE_NAMES } from '../../../core/i18n/language.service';
import { SupportedLanguage } from '../../../core/data/countries';
import { BranchContextService } from '../../../core/services/branch-context.service';
import { TrainingWizardService } from '../../../core/services/training-wizard.service';
import { AiAssistantService } from '../../../core/services/ai-assistant.service';
import { Sidebar } from '../sidebar/sidebar';
import { MemberQrModal } from '../../components/member-qr-modal/member-qr-modal';
import { MemberQrService } from '../../components/member-qr-modal/member-qr.service';
import { TrainingWizardModal } from '../../components/training-wizard-modal/training-wizard-modal';
import { AiAssistantModal } from '../../components/ai-assistant-modal/ai-assistant-modal';
import { PermissionService } from '../../../core/services/permission.service';
import { SaasSubscriptionService } from '../../../core/services/saas-subscription.service';

import { FormsModule } from '@angular/forms';

export interface RouteSearchResult {
  titleKey: string;
  categoryKey: string;
  icon: string;
  link: string;
  keywords: string[];
}

const SEARCHABLE_ROUTES: RouteSearchResult[] = [
  { titleKey: 'sidebar.items.dashboard', categoryKey: 'sidebar.groups.general', icon: 'dashboard', link: '/dashboard', keywords: ['ana sayfa', 'dashboard', 'panel', 'home'] },
  { titleKey: 'sidebar.items.adminOverview', categoryKey: 'sidebar.groups.general', icon: 'space_dashboard', link: '/admin/overview', keywords: ['genel bakış', 'durum', 'overview', 'rapor'] },
  { titleKey: 'sidebar.items.adminMembers', categoryKey: 'sidebar.groups.club', icon: 'groups', link: '/admin/members', keywords: ['üye', 'üyeler', 'kayıt', 'members'] },
  { titleKey: 'sidebar.items.adminSubscriptions', categoryKey: 'sidebar.groups.club', icon: 'card_membership', link: '/admin/subscriptions', keywords: ['abonelik', 'abone', 'yenileme', 'subscriptions'] },
  { titleKey: 'sidebar.items.adminGuestMembers', categoryKey: 'sidebar.groups.club', icon: 'person_search', link: '/admin/guest-members', keywords: ['misafir', 'ziyaretçi', 'guest'] },
  { titleKey: 'sidebar.items.adminPackages', categoryKey: 'sidebar.groups.sales', icon: 'sell', link: '/admin/packages', keywords: ['paket', 'fiyat', 'tarife', 'packages'] },
  { titleKey: 'sidebar.items.adminPos', categoryKey: 'sidebar.groups.pos', icon: 'shopping_cart_checkout', link: '/admin/shop', keywords: ['kasa', 'pos', 'market', 'satış', 'shop'] },
  { titleKey: 'sidebar.items.adminProducts', categoryKey: 'sidebar.groups.stock', icon: 'inventory_2', link: '/admin/products', keywords: ['ürün', 'stok', 'envanter', 'products'] },
  { titleKey: 'sidebar.items.adminSuppliers', categoryKey: 'sidebar.groups.stock', icon: 'local_shipping', link: '/admin/suppliers', keywords: ['tedarikçi', 'suppliers'] },
  { titleKey: 'sidebar.items.adminAccounting', categoryKey: 'sidebar.groups.finance', icon: 'account_balance', link: '/admin/accounting', keywords: ['muhasebe', 'kasa', 'gelir', 'accounting'] },
  { titleKey: 'sidebar.items.adminEInvoice', categoryKey: 'sidebar.groups.finance', icon: 'receipt_long', link: '/admin/e-invoice', keywords: ['fatura', 'e-fatura', 'uyumsoft', 'invoice'] },
  { titleKey: 'sidebar.items.adminAccessControl', categoryKey: 'sidebar.groups.access', icon: 'nfc', link: '/admin/access-control', keywords: ['turnike', 'kapı', 'rfid', 'qr', 'access'] },
  { titleKey: 'sidebar.items.classSchedule', categoryKey: 'sidebar.groups.club', icon: 'calendar_month', link: '/classes', keywords: ['ders', 'seans', 'classes'] },
  { titleKey: 'sidebar.items.ptAppointments', categoryKey: 'sidebar.groups.club', icon: 'event_available', link: '/appointments', keywords: ['randevu', 'pt', 'appointments'] },
  { titleKey: 'sidebar.items.adminDefinitions', categoryKey: 'sidebar.groups.definitions', icon: 'tune', link: '/admin/definitions', keywords: ['tanımlar', 'definitions'] },
  { titleKey: 'sidebar.items.adminDisciplines', categoryKey: 'sidebar.groups.definitions', icon: 'sports_martial_arts', link: '/admin/disciplines', keywords: ['branş', 'ekipman', 'disciplines'] },
  { titleKey: 'sidebar.items.adminWizard', categoryKey: 'sidebar.groups.definitions', icon: 'auto_awesome', link: '/admin/wizard', keywords: ['sihirbaz', 'wizard'] },
  { titleKey: 'sidebar.items.adminStaff', categoryKey: 'sidebar.groups.management', icon: 'badge', link: '/admin/staff', keywords: ['personel', 'çalışan', 'staff'] },
  { titleKey: 'sidebar.items.adminBranches', categoryKey: 'sidebar.groups.management', icon: 'store', link: '/admin/branches', keywords: ['şube', 'branches'] },
  { titleKey: 'sidebar.items.adminGymInfo', categoryKey: 'sidebar.groups.management', icon: 'business', link: '/admin/gym-info', keywords: ['salon bilgileri', 'gym'] },
  { titleKey: 'sidebar.items.adminSubscription', categoryKey: 'sidebar.groups.management', icon: 'card_membership', link: '/admin/subscription', keywords: ['lisans', 'paket', 'subscription'] },
  { titleKey: 'sidebar.items.workoutPlan', categoryKey: 'sidebar.groups.fitness', icon: 'fitness_center', link: '/workout', keywords: ['antrenman', 'workout'] },
  { titleKey: 'sidebar.items.bodyMeasurements', categoryKey: 'sidebar.groups.health', icon: 'monitor_weight', link: '/measurements', keywords: ['ölçüm', 'measurements'] },
  { titleKey: 'sidebar.items.waterTracker', categoryKey: 'sidebar.groups.health', icon: 'water_drop', link: '/water', keywords: ['su', 'water'] },
  { titleKey: 'sidebar.items.wallet', categoryKey: 'sidebar.groups.account', icon: 'account_balance_wallet', link: '/wallet', keywords: ['cüzdan', 'wallet'] },
  { titleKey: 'sidebar.items.profile', categoryKey: 'sidebar.groups.account', icon: 'person', link: '/profile', keywords: ['profil', 'profile'] },
];

export interface ShellNotification {
  id: string;
  titleKey: string;
  messageKey: string;
  time: string;
  type: 'warning' | 'info' | 'success';
  icon: string;
  read: boolean;
  link?: string;
}

/**
 * Masaüstü öncelikli uygulama kabuğu: Odivon UI Tasarım Sistemi standardı.
 * Sabit sol sidebar + üstte kurumsal Odivon araç çubuğu + içerik alanı + mobil alt bar (PWA).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    Sidebar,
    TranslocoPipe,
    MemberQrModal,
    TrainingWizardModal,
    AiAssistantModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly transloco = inject(TranslocoService);
  protected readonly qrService = inject(MemberQrService);
  protected readonly branchContext = inject(BranchContextService);
  protected readonly wizard = inject(TrainingWizardService);
  protected readonly aiService = inject(AiAssistantService);
  protected readonly permissions = inject(PermissionService);
  protected readonly saasSub = inject(SaasSubscriptionService);
  private readonly router = inject(Router);

  protected readonly languageNames = LANGUAGE_NAMES;
  protected readonly languages = Object.keys(LANGUAGE_NAMES) as SupportedLanguage[];

  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  // Topbar Page Search
  readonly searchQuery = signal('');
  readonly searchFocused = signal(false);

  readonly searchResults = computed<{ title: string; category: string; icon: string; link: string }[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_ROUTES.map((route) => {
      const title = this.transloco.translate(route.titleKey);
      const category = this.transloco.translate(route.categoryKey);
      return { ...route, title, category };
    }).filter((route) => {
      const matchTitle = route.title.toLowerCase().includes(q);
      const matchCategory = route.category.toLowerCase().includes(q);
      const matchKeywords = route.keywords.some((kw) => kw.toLowerCase().includes(q));
      return matchTitle || matchCategory || matchKeywords;
    }).slice(0, 8);
  });

  onSearchFocus(): void {
    this.searchFocused.set(true);
  }

  onSearchBlur(): void {
    setTimeout(() => this.searchFocused.set(false), 220);
  }

  navigateToRoute(link: string): void {
    this.searchQuery.set('');
    this.searchFocused.set(false);
    void this.router.navigateByUrl(link);
  }

  onMenuClick(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      this.mobileOpen.update((v) => !v);
    } else {
      this.collapsed.update((v) => !v);
    }
  }

  protected readonly notifications = signal<ShellNotification[]>([
    {
      id: 'notif-1',
      titleKey: 'shell.notif1Title',
      messageKey: 'shell.notif1Msg',
      time: '5m',
      type: 'warning',
      icon: 'notifications_active',
      read: false,
    },
    {
      id: 'notif-2',
      titleKey: 'shell.notif2Title',
      messageKey: 'shell.notif2Msg',
      time: '14:32',
      type: 'info',
      icon: 'door_sliding',
      read: false,
    },
    {
      id: 'notif-3',
      titleKey: 'shell.notif3Title',
      messageKey: 'shell.notif3Msg',
      time: '1h',
      type: 'warning',
      icon: 'inventory_2',
      read: false,
    },
    {
      id: 'notif-4',
      titleKey: 'shell.notif4Title',
      messageKey: 'shell.notif4Msg',
      time: '2h',
      type: 'success',
      icon: 'receipt_long',
      read: true,
    },
  ]);

  protected readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  markAllNotificationsAsRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  markNotificationAsRead(id: string): void {
    this.notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  protected readonly isStaff = computed(() => this.permissions.isStaff());
  protected readonly isAdmin = computed(() => this.permissions.isAdmin());

  toggleCollapse(): void {
    this.collapsed.update((v) => !v);
  }

  openMobileNav(): void {
    this.mobileOpen.set(true);
  }

  closeMobileNav(): void {
    this.mobileOpen.set(false);
  }

  openQrModal(): void {
    this.qrService.open();
  }

  setLanguage(lang: SupportedLanguage): void {
    this.language.setLanguage(lang);
  }

  initials(): string {
    const name = this.auth.profile()?.displayName || 'AD';
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  async logOut(): Promise<void> {
    await this.auth.logOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
