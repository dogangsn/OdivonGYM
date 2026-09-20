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
