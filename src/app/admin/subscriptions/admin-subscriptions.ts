import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { MemberDetailDrawer } from '../members/member-detail-drawer/member-detail-drawer';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminPackagesService } from '../packages/admin-packages.service';
import { BranchContextService } from '../../core/services/branch-context.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile, MembershipStatus } from '../../core/models/user-profile.model';
import { GymPackage } from '../../core/models/gym-package.model';
import { formatDate, formatDateTime, formatMoney } from '../../shared/ui/ui-utils';
import { Timestamp } from '@angular/fire/firestore';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

export type SubscriptionFilterStatus = 'all' | 'expired' | 'expiring' | 'active' | 'trial' | 'cancelled';
export type SubscriptionSortBy = 'urgency' | 'remaining_asc' | 'remaining_desc' | 'name' | 'newest';

export interface EnrichedMemberSubscription {
  member: UserProfile;
  computedStatus: 'expired' | 'expiring' | 'active' | 'trial' | 'cancelled';
  remainingDays: number | null;
  statusBadgeText: string;
  statusBadgeClass: string;
  remainingText: string;
  remainingBadgeClass: string;
  endsAtFormatted: string;
  startsAtFormatted: string;
  isExpired: boolean;
  isToday: boolean;
  isUrgent: boolean;
}

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    PageHeader,
    SlideOver,
    Field,
    MemberDetailDrawer,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-subscriptions.html',
  styleUrl: './admin-subscriptions.scss',
})
export class AdminSubscriptions {
  protected readonly transloco = inject(TranslocoService);
  private readonly membersService = inject(AdminMembersService);
  private readonly packagesService = inject(AdminPackagesService);
  protected readonly branchContext = inject(BranchContextService);
  private readonly alertService = inject(AlertService);
  private readonly auth = inject(AuthService);

  protected readonly money = formatMoney;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;

  // Data streams
  private readonly membersRaw = toSignal(this.membersService.watchMembers(), { initialValue: null });
  private readonly packagesRaw = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });

  protected readonly loading = computed(() => this.membersRaw() === null);
  protected readonly members = computed(() => this.membersRaw() ?? []);
  protected readonly availablePackages = computed(() =>
    (this.packagesRaw() ?? []).filter((p) => p.status === 'active'),
  );
  protected readonly branches = this.branchContext.branches;

  // Filter & Search states
  protected readonly statusFilter = signal<SubscriptionFilterStatus>('all');
  protected readonly searchTerm = signal<string>('');
  protected readonly selectedPackageFilter = signal<string>('all');
  protected readonly selectedBranchFilter = signal<string>('all');
  protected readonly sortBy = signal<SubscriptionSortBy>('urgency');

  // Enriched Member Subscriptions
  protected readonly enrichedSubscriptions = computed<EnrichedMemberSubscription[]>(() => {
    const rawList = this.members();
    const now = Date.now();
    const sevenDaysMs = 7 * 86400000;

    return rawList.map((m) => {
      const endsTs = m.membershipStatus === 'trial' ? m.trialEndsAt : m.membershipEndsAt;
      const endMs = endsTs ? endsTs.toMillis() : null;

      let remainingDays: number | null = null;
      let isExpired = false;
      let isToday = false;
      let isUrgent = false;

      if (endMs !== null) {
        const diffMs = endMs - now;
        remainingDays = Math.ceil(diffMs / 86400000);
        isExpired = remainingDays < 0;
        isToday = remainingDays === 0;
        isUrgent = !isExpired && remainingDays <= 7;
      }

      // Determine computed status
      let computedStatus: 'expired' | 'expiring' | 'active' | 'trial' | 'cancelled' = 'active';

      if (m.membershipStatus === 'cancelled') {
        computedStatus = 'cancelled';
      } else if (m.membershipStatus === 'trial') {
        computedStatus = 'trial';
      } else if (m.membershipStatus === 'expired' || isExpired) {
        computedStatus = 'expired';
      } else if (isUrgent) {
        computedStatus = 'expiring';
      } else {
        computedStatus = 'active';
      }

      // Format badges
      let statusBadgeText = this.transloco.translate('subscriptions.statusActive');
      let statusBadgeClass = 'badge-emerald';

      if (computedStatus === 'expired') {
        statusBadgeText = this.transloco.translate('subscriptions.statusExpired');
        statusBadgeClass = 'badge-rose';
      } else if (computedStatus === 'expiring') {
        statusBadgeText = this.transloco.translate('subscriptions.statusExpiring');
        statusBadgeClass = 'badge-amber';
      } else if (computedStatus === 'trial') {
        statusBadgeText = this.transloco.translate('dashboard.stat.statusTrial');
        statusBadgeClass = 'badge-sky';
      } else if (computedStatus === 'cancelled') {
        statusBadgeText = this.transloco.translate('subscriptions.statusFrozen');
        statusBadgeClass = 'badge-slate';
      }

      // Format remaining time text
      let remainingText = this.transloco.translate('dashboard.stat.notPlanned');
      let remainingBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

      if (remainingDays !== null) {
        if (isToday) {
          remainingText = this.transloco.translate('subscriptions.today');
          remainingBadgeClass = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 animate-pulse font-bold';
        } else if (remainingDays < 0) {
          const absDays = Math.abs(remainingDays);
          remainingText = this.transloco.translate('subscriptions.expiredDaysAgo', { days: absDays });
          remainingBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300';
        } else {
          remainingText = this.transloco.translate('subscriptions.daysRemaining', { days: remainingDays });
          if (remainingDays <= 7) {
            remainingBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-semibold';
          } else {
            remainingBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
          }
        }
      }

      return {
        member: m,
        computedStatus,
        remainingDays,
        statusBadgeText,
        statusBadgeClass,
        remainingText,
        remainingBadgeClass,
        endsAtFormatted: formatDate(endsTs),
        startsAtFormatted: formatDate(m.membershipStartsAt || m.trialStartedAt),
        isExpired,
        isToday,
        isUrgent,
      };
    });
  });

  // KPI Metrics
  protected readonly kpiMetrics = computed(() => {
    const list = this.enrichedSubscriptions();
    let total = list.length;
    let active = 0;
    let expired = 0;
    let expiringSoon = 0;
    let trial = 0;

    for (const item of list) {
      if (item.computedStatus === 'expired') expired++;
      else if (item.computedStatus === 'expiring') expiringSoon++;
      else if (item.computedStatus === 'active') active++;
      else if (item.computedStatus === 'trial') trial++;
    }

    return { total, active, expired, expiringSoon, trial };
  });

  // Distinct package labels for filter dropdown
  protected readonly distinctPackageOptions = computed(() => {
    const fromPackages = this.availablePackages().map((p) => p.name);
    const fromMembers = this.members()
      .map((m) => m.packageLabel?.trim())
      .filter((l): l is string => !!l);
    return Array.from(new Set([...fromPackages, ...fromMembers])).sort();
  });

  // Filtered & Sorted Subscriptions List
  protected readonly filteredSubscriptions = computed<EnrichedMemberSubscription[]>(() => {
    let list = this.enrichedSubscriptions();
    const stFilter = this.statusFilter();
    const search = this.searchTerm().trim().toLowerCase();
    const pkgFilter = this.selectedPackageFilter();
    const brFilter = this.selectedBranchFilter();
    const sort = this.sortBy();

    // 1. Status Filter
    if (stFilter !== 'all') {
      list = list.filter((item) => item.computedStatus === stFilter);
    }

    // 2. Package Filter
    if (pkgFilter !== 'all') {
      list = list.filter((item) => item.member.packageLabel?.trim() === pkgFilter);
    }

    // 3. Branch Filter
    if (brFilter !== 'all') {
      list = list.filter((item) => item.member.branchId === brFilter);
    }

    // 4. Search Query
    if (search) {
      list = list.filter((item) => {
        const m = item.member;
        return (
          m.displayName?.toLowerCase().includes(search) ||
          m.phone?.toLowerCase().includes(search) ||
          m.memberNumber?.toLowerCase().includes(search) ||
          m.packageLabel?.toLowerCase().includes(search) ||
          m.email?.toLowerCase().includes(search)
        );
      });
    }

    // 5. Sorting
    return [...list].sort((a, b) => {
      if (sort === 'urgency') {
        // En acil (Bugün bitenler & süresi dolanlar en üstte)
        const dayA = a.remainingDays ?? 9999;
        const dayB = b.remainingDays ?? 9999;
        return dayA - dayB;
      }
      if (sort === 'remaining_asc') {
        const dayA = a.remainingDays ?? 9999;
        const dayB = b.remainingDays ?? 9999;
        return dayA - dayB;
      }
      if (sort === 'remaining_desc') {
        const dayA = a.remainingDays ?? -9999;
        const dayB = b.remainingDays ?? -9999;
        return dayB - dayA;
      }
      if (sort === 'name') {
        return (a.member.displayName || '').localeCompare(b.member.displayName || '', 'tr');
      }
      if (sort === 'newest') {
        const tsA = a.member.updatedAt?.toMillis() ?? 0;
        const tsB = b.member.updatedAt?.toMillis() ?? 0;
        return tsB - tsA;
      }
      return 0;
    });
  });

  // ==========================================
  // QUICK RENEWAL SLIDEOVER STATE & METHODS
  // ==========================================
  protected readonly renewDrawerOpen = signal(false);
  protected readonly renewMember = signal<UserProfile | null>(null);
  protected readonly renewSearchQuery = signal<string>('');
  protected readonly renewPackageName = signal<string>('1 Aylık Standart Fitness');
  protected readonly renewDurationDays = signal<number>(30);
  protected readonly renewPrice = signal<number>(1250);
  protected readonly renewPaymentMethod = signal<'cash' | 'card' | 'transfer' | 'wallet'>('cash');
  protected readonly renewRecordAccounting = signal<boolean>(true);
  protected readonly renewNotes = signal<string>('');
  protected readonly renewSubmitting = signal<boolean>(false);

  protected readonly renewMemberSearchMatches = computed(() => {
    const q = this.renewSearchQuery().trim().toLowerCase();
    if (!q) return this.members().slice(0, 8);
    return this.members()
      .filter((m) =>
        m.displayName?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.memberNumber?.toLowerCase().includes(q),
      )
      .slice(0, 10);
  });

  /** Hesaplanan Yeni Bitiş Tarihi Önizlemesi */
  protected readonly calculatedNewEndsAtPreview = computed(() => {
    const m = this.renewMember();
    const days = this.renewDurationDays();
    if (!m) return null;

    let baseDate = new Date();
    let isExtensionFromFuture = false;

    if (m.membershipStatus === 'active' && m.membershipEndsAt) {
      const currentEndMs = m.membershipEndsAt.toMillis();
      if (currentEndMs > Date.now()) {
        baseDate = new Date(currentEndMs);
        isExtensionFromFuture = true;
      }
    }

    const calculated = new Date(baseDate.getTime());
    calculated.setDate(calculated.getDate() + days);

    return {
      newDate: calculated.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }),
      isExtensionFromFuture,
      baseDateFormatted: baseDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
  });

  openRenewDrawer(member?: UserProfile): void {
    if (member) {
      this.renewMember.set(member);
    } else {
      const first = this.members()[0] ?? null;
      this.renewMember.set(first);
    }

    this.renewSearchQuery.set('');
    this.renewNotes.set('');
    this.renewRecordAccounting.set(true);

    // Auto set package based on available packages or member's previous package
    const pkgs = this.availablePackages();
    const m = this.renewMember();
    const previousLabel = m?.packageLabel?.trim();
    const matched = pkgs.find((p) => p.name.trim() === previousLabel) || pkgs[0];

    if (matched) {
      this.renewPackageName.set(matched.name);
      this.renewDurationDays.set(matched.durationDays);
      this.renewPrice.set(matched.price);
    } else {
      this.renewPackageName.set(previousLabel || '1 Aylık Standart Fitness');
      this.renewDurationDays.set(30);
      this.renewPrice.set(1250);
    }

    this.renewDrawerOpen.set(true);
  }

  selectMemberForRenew(m: UserProfile): void {
    this.renewMember.set(m);
    this.renewSearchQuery.set('');

    const pkgs = this.availablePackages();
    const matched = pkgs.find((p) => p.name.trim() === m.packageLabel?.trim());
    if (matched) {
      this.renewPackageName.set(matched.name);
      this.renewDurationDays.set(matched.durationDays);
      this.renewPrice.set(matched.price);
    }
  }

  selectPackagePreset(pkg: GymPackage): void {
    this.renewPackageName.set(pkg.name);
    this.renewDurationDays.set(pkg.durationDays);
    this.renewPrice.set(pkg.price);
  }

  async saveRenew(): Promise<void> {
    const m = this.renewMember();
    if (!m) {
      this.alertService.toastError('Lütfen yenileme yapılacak sporcuyu seçin.');
      return;
    }

    const pkgName = this.renewPackageName().trim();
    const days = this.renewDurationDays();
    const price = this.renewPrice();

    if (!pkgName) {
      this.alertService.toastError('Lütfen paket adını belirtin.');
      return;
    }
    if (days <= 0) {
      this.alertService.toastError('Abonelik süresi en az 1 gün olmalıdır.');
      return;
    }

    const preview = this.calculatedNewEndsAtPreview();
    const confirmMessage = `<strong>${m.displayName}</strong> adlı sporcunun aboneliği <strong>${pkgName}</strong> (${days} Gün) olarak yenilenecek.<br><br>Yeni Bitiş Tarihi: <strong>${preview?.newDate}</strong><br>Tahsilat: <strong>₺${price.toLocaleString('tr-TR')}</strong> (${this.renewPaymentMethod().toUpperCase()})`;

    const confirmed = await this.alertService.actionConfirm(
      'Abonelik Yenileme Onayı',
      confirmMessage,
      'Evet, Yenile ve Onayla',
    );
    if (!confirmed) return;

    this.renewSubmitting.set(true);
    try {
      await this.membersService.renewMembership(m, {
        packageName: pkgName,
        durationDays: days,
        price,
        paymentMethod: this.renewPaymentMethod(),
        notes: this.renewNotes().trim(),
        recordAccounting: this.renewRecordAccounting(),
      });

      this.alertService.toastSuccess(`${m.displayName} aboneliği başarıyla yenilendi!`);
      this.renewDrawerOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Yenileme işlemi gerçekleştirilemedi.');
    } finally {
      this.renewSubmitting.set(false);
    }
  }

  // ==========================================
  // QUICK EXTEND DAYS MODAL STATE & METHODS
  // ==========================================
  protected readonly extendModalOpen = signal(false);
  protected readonly extendMember = signal<UserProfile | null>(null);
  protected readonly extendDays = signal<number>(7);
  protected readonly extendReason = signal<string>('Müşteri Memnuniyeti / Telafi');
  protected readonly extendSubmitting = signal<boolean>(false);

  openExtendModal(member: UserProfile, defaultDays = 7): void {
    this.extendMember.set(member);
    this.extendDays.set(defaultDays);
    this.extendReason.set('Müşteri Memnuniyeti / Telafi');
    this.extendModalOpen.set(true);
  }

  protected readonly calculatedExtensionPreview = computed(() => {
    const m = this.extendMember();
    const days = this.extendDays();
    if (!m) return '';

    let base = new Date();
    if (m.membershipEndsAt) {
      const ms = m.membershipEndsAt.toMillis();
      if (ms > Date.now()) base = new Date(ms);
    }
    base.setDate(base.getDate() + days);
    return base.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  });

  async saveExtend(): Promise<void> {
    const m = this.extendMember();
    const days = this.extendDays();
    if (!m || days <= 0) return;

    this.extendSubmitting.set(true);
    try {
      await this.membersService.extendMembershipDays(m, days, this.extendReason().trim());
      this.alertService.toastSuccess(`${m.displayName} üyeliğine +${days} gün süre eklendi!`);
      this.extendModalOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Süre uzatma başarısız oldu.');
    } finally {
      this.extendSubmitting.set(false);
    }
  }

  // ==========================================
  // FREEZE SUBSCRIPTION MODAL STATE & METHODS
  // ==========================================
  protected readonly freezeModalOpen = signal(false);
  protected readonly freezeMember = signal<UserProfile | null>(null);
  protected readonly freezeDays = signal<number>(15);
  protected readonly freezeReason = signal<string>('Üye Talebi / Seyahat');
  protected readonly freezeSubmitting = signal<boolean>(false);

  openFreezeModal(member: UserProfile, defaultDays = 15): void {
    this.freezeMember.set(member);
    this.freezeDays.set(defaultDays);
    this.freezeReason.set('Üye Talebi / Seyahat');
    this.freezeModalOpen.set(true);
  }

  async saveFreeze(): Promise<void> {
    const m = this.freezeMember();
    const days = this.freezeDays();
    if (!m || days <= 0) return;

    this.freezeSubmitting.set(true);
    try {
      await this.membersService.freezeMembership(m, days, this.freezeReason().trim());
      this.alertService.toastSuccess(`${m.displayName} üyeliği ${days} gün donduruldu.`);
      this.freezeModalOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Dondurma işlemi gerçekleştirilemedi.');
    } finally {
      this.freezeSubmitting.set(false);
    }
  }

  // ==========================================
  // CANCEL SUBSCRIPTION ACTION
  // ==========================================
  async confirmCancel(member: UserProfile): Promise<void> {
    const confirmed = await this.alertService.deleteConfirm(
      member.displayName,
      `<strong>${member.displayName}</strong> sporcusunun aboneliğini iptal etmek istediğinize emin misiniz? Sporcu turnikeden geçiş yapamayacaktır.`,
    );
    if (!confirmed) return;

    try {
      await this.membersService.cancelMembership(member, 'Yönetici tarafından sonlandırıldı.');
      this.alertService.toastSuccess(`${member.displayName} aboneliği iptal edildi.`);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError('İptal işlemi başarısız.');
    }
  }

  // ==========================================
  // WHATSAPP REMINDER MODAL STATE & METHODS
  // ==========================================
  protected readonly whatsAppModalOpen = signal(false);
  protected readonly whatsAppMember = signal<UserProfile | null>(null);
  protected readonly whatsAppMessage = signal<string>('');

  openWhatsAppModal(item: EnrichedMemberSubscription): void {
    const m = item.member;
    this.whatsAppMember.set(m);

    let template = '';
    const gymName = 'Odivon GYM';

    if (item.computedStatus === 'expired') {
      template = `Merhaba Sayın ${m.displayName},\n\n${gymName} spor kulübündeki üyeliğiniz ${item.endsAtFormatted} tarihinde sona ermiştir. Spor rutininize ara vermeden devam edebilmeniz ve size özel avantajlı yenileme paketlerimizden faydalanabilmeniz için sizi kulübümüze bekliyoruz! 💪🏋️\n\nSağlıklı ve fit günler dileriz.`;
    } else if (item.computedStatus === 'expiring') {
      template = `Merhaba Sayın ${m.displayName},\n\n${gymName} üyeliğinizin bitmesine ${item.remainingDays} gün kaldı (${item.endsAtFormatted}). Antrenman temponuzun aksamaması için resepsiyondan veya online panelden aboneliğinizi kolayca yenileyebilirsiniz. 🎯\n\nHer zaman yanınızdayız!`;
    } else {
      template = `Merhaba Sayın ${m.displayName},\n\n${gymName} kulübümüzdeki aktif aboneliğiniz ile ilgili bilgilendirme: Mevcut paketiniz ${item.endsAtFormatted} tarihine kadar geçerlidir. Harika antrenmanlar dileriz! 🚀`;
    }

    this.whatsAppMessage.set(template);
    this.whatsAppModalOpen.set(true);
  }

  cleanPhone(phone?: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '90' + digits.slice(1);
    } else if (!digits.startsWith('90') && digits.length === 10) {
      digits = '90' + digits;
    }
    return digits;
  }

  sendWhatsApp(): void {
    const m = this.whatsAppMember();
    if (!m?.phone) {
      this.alertService.toastError('Sporcunun kayıtlı telefon numarası bulunamadı.');
      return;
    }
    const phone = this.cleanPhone(m.phone);
    const text = encodeURIComponent(this.whatsAppMessage());
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    this.whatsAppModalOpen.set(false);
  }

  copyWhatsAppText(): void {
    navigator.clipboard.writeText(this.whatsAppMessage()).then(() => {
      this.alertService.toastSuccess('Mesaj panoya kopyalandı.');
    });
  }

  // ==========================================
  // MEMBER DETAIL DRAWER INTEGRATION
  // ==========================================
  protected readonly detailDrawerOpen = signal(false);
  protected readonly selectedMemberForDetail = signal<UserProfile | null>(null);

  openDetailDrawer(member: UserProfile): void {
    this.selectedMemberForDetail.set(member);
    this.detailDrawerOpen.set(true);
  }

  // ==========================================
  // EXPORT TO CSV
  // ==========================================
  exportCsv(): void {
    const list = this.filteredSubscriptions();
    if (list.length === 0) {
      this.alertService.toastInfo('Dışa aktarılacak sporcu kaydı bulunamadı.');
      return;
    }

    const headers = ['Üye No', 'Sporcu Adı', 'Telefon', 'E-Posta', 'Mevcut Paket', 'Başlangıç', 'Bitiş Tarihi', 'Kalan Gün', 'Durum', 'Şube'];
    const rows = list.map((item) => [
      `"${item.member.memberNumber || '-'}"`,
      `"${item.member.displayName || ''}"`,
      `"${item.member.phone || ''}"`,
      `"${item.member.email || ''}"`,
      `"${item.member.packageLabel || 'Paketsiz'}"`,
      `"${item.startsAtFormatted}"`,
      `"${item.endsAtFormatted}"`,
      `"${item.remainingDays !== null ? item.remainingDays : '-'}"`,
      `"${item.statusBadgeText}"`,
      `"${item.member.branchName || '-'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `odivon_abonelik_listesi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.alertService.toastSuccess('CSV listesi başarıyla indirildi.');
  }

  // Preset Filters
  setFilter(status: SubscriptionFilterStatus): void {
    this.statusFilter.set(status);
  }

  resetFilters(): void {
    this.statusFilter.set('all');
    this.searchTerm.set('');
    this.selectedPackageFilter.set('all');
    this.selectedBranchFilter.set('all');
    this.sortBy.set('urgency');
  }
}
