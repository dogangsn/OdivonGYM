import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
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
  title: string;
  category: string;
  icon: string;
  link: string;
  keywords: string[];
}

const SEARCHABLE_ROUTES: RouteSearchResult[] = [
  { title: 'Dashboard', category: 'Genel', icon: 'dashboard', link: '/dashboard', keywords: ['ana sayfa', 'dashboard', 'panel', 'istatistik', 'özet'] },
  { title: 'Salon Durumu & Genel Bakış', category: 'Genel', icon: 'space_dashboard', link: '/admin/overview', keywords: ['genel bakış', 'durum', 'overview', 'rapor'] },
  { title: 'Üye Kayıtları & Yönetimi', category: 'Kulüp', icon: 'groups', link: '/admin/members', keywords: ['üye', 'üyeler', 'kayıt', 'sporcu', 'profil', 'members'] },
  { title: 'Misafir Üyeler & Anket', category: 'Kulüp', icon: 'person_search', link: '/admin/guest-members', keywords: ['misafir', 'ziyaretçi', 'anket', 'tanıtım', 'guest'] },
  { title: 'Üyelik Paketleri & Fiyatlandırma', category: 'Satış', icon: 'sell', link: '/admin/packages', keywords: ['paket', 'fiyat', 'abonelik', 'tarife', 'packages'] },
  { title: 'Hızlı Kasa & POS', category: 'Kasa / POS', icon: 'shopping_cart_checkout', link: '/admin/shop', keywords: ['kasa', 'pos', 'market', 'satış', 'ödeme', 'shop'] },
  { title: 'Ürün & Stok Yönetimi', category: 'Ürün & Stok', icon: 'inventory_2', link: '/admin/shop', keywords: ['ürün', 'stok', 'envanter', 'protein', 'su', 'bar'] },
  { title: 'Tedarikçiler', category: 'Ürün & Stok', icon: 'local_shipping', link: '/admin/suppliers', keywords: ['tedarikçi', 'firmalar', 'toptancı', 'suppliers'] },
  { title: 'Kasa & Muhasebe', category: 'Finans', icon: 'account_balance', link: '/admin/accounting', keywords: ['muhasebe', 'kasa', 'gelir', 'gider', 'finans', 'accounting'] },
  { title: 'E-Fatura & Uyumsoft', category: 'Finans', icon: 'receipt_long', link: '/admin/e-invoice', keywords: ['fatura', 'e-fatura', 'e-arşiv', 'uyumsoft', 'mali mühür'] },
  { title: 'Turnike & Geçiş Kontrol', category: 'Erişim', icon: 'nfc', link: '/admin/access-control', keywords: ['turnike', 'kapı', 'rfid', 'qr', 'geçiş', 'donanım'] },
  { title: 'Ders & Seans Takvimi', category: 'Kulüp', icon: 'calendar_month', link: '/classes', keywords: ['ders', 'seans', 'grup dersi', 'kickboks', 'pilates', 'classes'] },
  { title: 'PT Randevuları', category: 'Kulüp', icon: 'event_available', link: '/appointments', keywords: ['randevu', 'pt', 'özel ders', 'antrenör', 'appointments'] },
  { title: 'Genel Tanımlar', category: 'Tanımlar', icon: 'tune', link: '/admin/definitions', keywords: ['tanımlar', 'kategori', 'aletler', 'branş', 'donanım', 'definitions'] },
  { title: 'Branşlar & Ekipman', category: 'Tanımlar', icon: 'sports_martial_arts', link: '/admin/disciplines', keywords: ['branş', 'disiplin', 'ekipman', 'cihaz', 'disciplines'] },
  { title: 'Eğitim Sihirbazı', category: 'Tanımlar', icon: 'auto_awesome', link: '/admin/wizard', keywords: ['sihirbaz', 'zincirleme', 'tanımlama', 'wizard'] },
  { title: 'Personel & Rol Yönetimi', category: 'Yönetim', icon: 'badge', link: '/admin/staff', keywords: ['personel', 'çalışan', 'hoca', 'antrenör', 'staff'] },
  { title: 'Şubeler', category: 'Yönetim', icon: 'store', link: '/admin/branches', keywords: ['şube', 'şubeler', 'branches'] },
  { title: 'Salon Bilgileri', category: 'Yönetim', icon: 'business', link: '/admin/gym-info', keywords: ['salon bilgileri', 'logo', 'çalışma saatleri', 'gym'] },
  { title: 'SaaS Paket & Lisans', category: 'Yönetim', icon: 'card_membership', link: '/admin/subscription', keywords: ['lisans', 'paket', 'abonelik', 'odivon lisans', 'subscription'] },
  { title: 'Antrenman Programım', category: 'Sporcu', icon: 'fitness_center', link: '/workout', keywords: ['antrenman', 'program', 'workout'] },
  { title: 'Vücut Ölçümlerim', category: 'Sporcu', icon: 'monitor_weight', link: '/measurements', keywords: ['ölçüm', 'kilo', 'yağ oranı', 'inbody'] },
  { title: 'Su Takibi', category: 'Sporcu', icon: 'water_drop', link: '/water', keywords: ['su', 'su takibi', 'litre'] },
  { title: 'Cüzdanım', category: 'Sporcu', icon: 'account_balance_wallet', link: '/wallet', keywords: ['cüzdan', 'bakiye', 'para yükle'] },
  { title: 'Profil & Ayarlarım', category: 'Sporcu', icon: 'person', link: '/profile', keywords: ['profil', 'ayarlar', 'şifre', 'profile'] },
];

export interface ShellNotification {
  id: string;
  title: string;
  message: string;
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

  readonly searchResults = computed<RouteSearchResult[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_ROUTES.filter((route) => {
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
      title: 'Üyelik Süresi Uyarısı',
      message: 'Ahmet Yılmaz üyesinin paket süresi 3 gün sonra doluyor. Otomatik yenileme teklifi gönderildi.',
      time: '5 dk önce',
      type: 'warning',
      icon: 'notifications_active',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Turnike Geçişi Onaylandı',
      message: 'Kadıköy Şube 1 Nolu Turnikeden Zeynep Kaya geçiş yaptı.',
      time: '14:32',
      type: 'info',
      icon: 'door_sliding',
      read: false,
    },
    {
      id: 'notif-3',
      title: 'Kritik Stok Seviyesi',
      message: 'Optimum Gold Whey Protein (Çikolata) stoğu kritik seviyede: 2 adet kaldı.',
      time: '1 saat önce',
      type: 'warning',
      icon: 'inventory_2',
      read: false,
    },
    {
      id: 'notif-4',
      title: 'Uyumsoft E-Fatura Kesildi',
      message: 'GİB onaylı #ODV20260001 nolu e-arşiv fatura başarıyla mühürlendi.',
      time: '2 saat önce',
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
