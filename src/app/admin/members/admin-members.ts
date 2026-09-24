import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatMoney } from '../../shared/ui/ui-utils';
import { AuthService } from '../../core/auth/auth.service';
import { BranchContextService } from '../../core/services/branch-context.service';
import { AdminMembersService } from './admin-members.service';
import { MembershipStatus, UserProfile } from '../../core/models/user-profile.model';
import { Router } from '@angular/router';
import { MemberFormDialog } from './member-form-dialog/member-form-dialog';
import { MemberDetailDrawer } from './member-detail-drawer/member-detail-drawer';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';
import { AlertService } from '../../core/services/alert.service';

const STATUS_LABEL: Record<MembershipStatus, string> = {
  trial: 'Deneme',
  active: 'Aktif',
  expired: 'Süresi Bitti',
  cancelled: 'İptal',
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  active:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  expired: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const GENDER_LABEL: Record<string, string> = {
  female: 'Kadın',
  male: 'Erkek',
  unspecified: 'Belirtilmemiş',
};

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, MemberFormDialog, MemberDetailDrawer, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.scss',
})
export class AdminMembers {
  private readonly membersService = inject(AdminMembersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly saasSub = inject(SaasSubscriptionService);
  protected readonly branchContext = inject(BranchContextService);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusBadgeClass = STATUS_BADGE_CLASS;
  protected readonly genderLabel = GENDER_LABEL;
  protected readonly searchTerm = signal('');
  protected readonly selectedBranchFilter = signal('');
  protected readonly showArchived = signal(false);

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly pageSizeOptions = [10, 25, 50, 100];

  protected readonly branches = this.branchContext.branches;
  protected readonly drawerOpen = signal(false);
  protected readonly editingMember = signal<UserProfile | null>(null);
  protected readonly viewingMember = signal<UserProfile | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly money = formatMoney;
  /** Çok-kiracılı modelden önce oluşmuş eski hesaplarda `tenantId` yok — hiçbir salon verisi görünmez/yazılamaz. */
  protected readonly missingTenant = computed(() => !this.auth.profile()?.tenantId);

  protected readonly walletMember = signal<UserProfile | null>(null);
  protected readonly walletSubmitting = signal(false);
  protected readonly walletError = signal('');
  protected readonly walletForm = this.fb.nonNullable.group({
    type: ['deposit' as 'deposit' | 'debit'],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['cash' as 'cash' | 'card' | 'transfer'],
    description: ['', [Validators.required]],
  });

  private readonly members = toSignal(this.membersService.watchMembers(), { initialValue: null });

  protected readonly loading = computed(() => this.members() === null);

  protected readonly activeCount = computed(() => (this.members() ?? []).filter((m) => !m.isArchived).length);
  protected readonly archivedCount = computed(() => (this.members() ?? []).filter((m) => !!m.isArchived).length);

  protected readonly filteredMembers = computed<UserProfile[]>(() => {
    let list = this.members() ?? [];
    const isArchivedView = this.showArchived();
    list = list.filter((m) => (isArchivedView ? !!m.isArchived : !m.isArchived));

    const branchFilter = this.selectedBranchFilter();
    if (branchFilter) {
      list = list.filter((m) => m.branchId === branchFilter);
    }
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(term) ||
        m.email?.toLowerCase().includes(term) ||
        m.phone?.toLowerCase().includes(term) ||
        m.memberNumber?.toLowerCase().includes(term) ||
        m.rfidCardNumber?.toLowerCase().includes(term) ||
        m.branchName?.toLowerCase().includes(term),
    );
  });

  // Pagination computed
  protected readonly totalItems = computed(() => this.filteredMembers().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  protected readonly startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());
  protected readonly endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.totalItems()));

  protected readonly paginatedMembers = computed(() => {
    const start = this.startIndex();
    return this.filteredMembers().slice(start, start + this.pageSize());
  });

  protected readonly visiblePages = computed<number[]>(() => {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onBranchChange(branchId: string): void {
    this.selectedBranchFilter.set(branchId);
    this.currentPage.set(1);
  }

  setShowArchived(val: boolean): void {
    this.showArchived.set(val);
    this.currentPage.set(1);
  }

  onPageSizeChange(size: number | string): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  openNewMemberDrawer(): void {
    const check = this.saasSub.canAddMember();
    if (!check.allowed) {
      this.snackBar
        .open(check.reason || 'Üye kotası limitine ulaşıldı.', 'Paketi Yükselt', { duration: 6000 })
        .onAction()
        .subscribe(() => {
          void this.router.navigateByUrl('/admin/subscription');
        });
      return;
    }
    this.viewingMember.set(null);
    this.editingMember.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(member: UserProfile): void {
    this.editingMember.set(member);
    this.drawerOpen.set(true);
  }

  openDetailDrawer(member: UserProfile): void {
    this.viewingMember.set(member);
  }

  closeDetailDrawer(): void {
    this.viewingMember.set(null);
  }

  onDetailEditRequested(member: UserProfile): void {
    this.closeDetailDrawer();
    this.openEditDrawer(member);
  }

  onDetailWalletRequested(member: UserProfile): void {
    this.openWallet(member);
  }

  onDrawerClosed(saved: boolean): void {
    this.drawerOpen.set(false);
    if (saved) {
      this.snackBar.open(
        this.editingMember() ? 'Üye bilgileri güncellendi.' : 'Üye başarıyla oluşturuldu.',
        'Kapat',
        { duration: 3000 },
      );
    }
    this.editingMember.set(null);
  }

  walletErr(name: keyof typeof this.walletForm.controls, messages: Record<string, string>): string {
    return firstError(this.walletForm.controls[name], messages);
  }

  openWallet(member: UserProfile): void {
    this.walletError.set('');
    this.walletForm.reset({ type: 'deposit', amount: 0, paymentMethod: 'cash', description: 'Bakiye yükleme' });
    this.walletMember.set(member);
  }

  closeWallet(): void {
    this.walletMember.set(null);
  }

  async submitWallet(): Promise<void> {
    const member = this.walletMember();
    if (!member || this.walletSubmitting()) return;
    if (this.walletForm.invalid) {
      this.walletForm.markAllAsTouched();
      return;
    }
    this.walletSubmitting.set(true);
    this.walletError.set('');
    try {
      const v = this.walletForm.getRawValue();
      await this.membersService.adjustWallet(member, {
        type: v.type,
        amount: v.amount,
        description: v.description.trim(),
        paymentMethod: v.paymentMethod,
      });
      this.snackBar.open(`${member.displayName}: bakiye güncellendi.`, 'Kapat', { duration: 3000 });
      this.closeWallet();
    } catch (error) {
      this.walletError.set(error instanceof Error && error.message ? error.message : 'Kaydedilemedi, tekrar dene.');
    } finally {
      this.walletSubmitting.set(false);
    }
  }

  async deleteMember(member: UserProfile): Promise<void> {
    const ok = await this.alertService.deleteConfirm(
      member.displayName,
      `<strong>"${member.displayName}"</strong> üyesinin profilini silmek istediğinize emin misiniz?<br><br><span class="text-xs text-slate-500 dark:text-slate-400">Üyenin giriş hesabı silinmez; profili silinen üye artık salon verilerine erişemez.</span>`,
    );
    if (!ok) return;
    try {
      await this.membersService.deleteMember(member.uid);
      this.alertService.toastSuccess('Üye profili silindi.');
    } catch {
      this.alertService.toastError('Üye silinemedi, tekrar dene.');
    }
  }

  async toggleArchive(member: UserProfile): Promise<void> {
    const isArchiving = !member.isArchived;
    const confirmMsg = isArchiving
      ? `<strong>"${member.displayName}"</strong> adlı üyeyi arşive kaldırmak istediğinize emin misiniz?<br><br><span class="text-xs text-slate-500 dark:text-slate-400">Arşivlenen üyeler aktif üye listesinde ve otomatik geçişlerde gizlenir, ancak geçmiş verileri ve bakiye hareketleri korunur.</span>`
      : `<strong>"${member.displayName}"</strong> adlı üyeyi arşivden çıkarıp tekrar aktif üye listesine almak istediğinize emin misiniz?`;

    const ok = await this.alertService.deleteConfirm(
      isArchiving ? 'Arşive Kaldır' : 'Arşivden Çıkar',
      confirmMsg,
    );
    if (!ok) return;

    try {
      await this.membersService.toggleArchiveMember(member.uid, isArchiving);
      this.alertService.toastSuccess(
        isArchiving ? 'Üye arşive kaldırıldı.' : 'Üye arşivden çıkarıldı ve aktifleştirildi.',
      );
    } catch {
      this.alertService.toastError('İşlem tamamlanamadı, lütfen tekrar deneyin.');
    }
  }

  async changeStatus(member: UserProfile, status: MembershipStatus): Promise<void> {
    if (status === member.membershipStatus) return;
    try {
      await this.membersService.setMembershipStatus(member.uid, status);
      this.snackBar.open(`${member.displayName} → ${this.statusLabel[status]}`, 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Durum güncellenemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }

  initials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  formatDate(ts: UserProfile['createdAt'] | undefined): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
