import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { formatMoney, formatDateTime, toMillis } from '../../shared/ui/ui-utils';
import { ExitPaymentsService } from './exit-payments.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminShopService } from '../shop/admin-shop.service';
import { ExitPayment } from '../../core/models/exit-payment.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { ShopProduct } from '../../core/models/shop-product.model';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-admin-exit-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-exit-payments.html',
  styleUrl: './admin-exit-payments.scss',
})
export class AdminExitPayments {
  private readonly exitPaymentsService = inject(ExitPaymentsService);
  private readonly membersService = inject(AdminMembersService);
  private readonly shopService = inject(AdminShopService);
  private readonly alertService = inject(AlertService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  // Search & Status Filters
  protected readonly search = signal<string>('');
  protected readonly statusFilter = signal<'all' | 'open' | 'collected' | 'cancelled'>('open');

  // Real-time Streams
  private readonly tabsData = toSignal(this.exitPaymentsService.watchExitPayments(), {
    initialValue: [] as ExitPayment[],
  });
  private readonly membersData = toSignal(this.membersService.watchMembers(), {
    initialValue: [] as UserProfile[],
  });
  private readonly productsData = toSignal(this.shopService.watchProducts(), {
    initialValue: [] as ShopProduct[],
  });

  protected readonly allTabs = computed(() => this.tabsData() ?? []);
  protected readonly members = computed(() => this.membersData() ?? []);
  protected readonly products = computed(() =>
    (this.productsData() ?? []).filter((p) => p.status === 'active'),
  );

  // Searchable Member Popover State (shared by New Tab & Collect Modals)
  protected readonly memberDropdownOpen = signal(false);
  protected readonly collectMemberDropdownOpen = signal(false);
  protected readonly memberSearchQuery = signal('');
  protected readonly remoteSearchedMembers = signal<UserProfile[]>([]);
  protected readonly isSearchingRemote = signal(false);
  private memberSearchDebounce: ReturnType<typeof setTimeout> | null = null;

  protected readonly activeMembersPool = computed(() => {
    const map = new Map<string, UserProfile>();
    for (const m of this.members()) {
      if (m?.uid) map.set(m.uid, m);
    }
    for (const m of this.remoteSearchedMembers()) {
      if (m?.uid && !map.has(m.uid)) map.set(m.uid, m);
    }
    return Array.from(map.values())
      .filter((m) => !m.isArchived && (!m.membershipStatus || m.membershipStatus === 'active'))
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'tr'));
  });

  protected readonly filteredMembersForPicker = computed(() => {
    const list = this.activeMembersPool();
    const q = this.memberSearchQuery().trim().toLocaleLowerCase('tr');
    if (!q) return list.slice(0, 30);
    return list
      .filter((m) => {
        const name = (m.displayName || '').toLocaleLowerCase('tr');
        const num = String(m.memberNumber || '').toLocaleLowerCase('tr');
        const phone = String(m.phone || '').toLocaleLowerCase('tr');
        return name.includes(q) || num.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  });

  constructor() {
    effect(() => {
      const q = this.memberSearchQuery().trim();
      if (this.memberSearchDebounce) clearTimeout(this.memberSearchDebounce);
      if (q.length < 2) {
        this.isSearchingRemote.set(false);
        return;
      }
      this.isSearchingRemote.set(true);
      this.memberSearchDebounce = setTimeout(async () => {
        try {
          const results = await this.membersService.searchMembers(q, {
            status: 'active',
            archived: false,
            limit: 30,
          });
          this.remoteSearchedMembers.set(results);
        } catch {
          // ignore
        } finally {
          this.isSearchingRemote.set(false);
        }
      }, 250);
    });
  }

  // Executive KPIs
  protected readonly openTabsCount = computed(
    () => this.allTabs().filter((t) => t.status === 'open').length,
  );

  protected readonly openTabsTotal = computed(() =>
    this.allTabs()
      .filter((t) => t.status === 'open')
      .reduce((sum, t) => sum + (t.totalAmount || 0), 0),
  );

  protected readonly todayCollectedTotal = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return this.allTabs()
      .filter((t) => t.status === 'collected' && toMillis(t.collectedAt || t.updatedAt) >= todayMs)
      .reduce((sum, t) => sum + (t.collectedAmount ?? t.totalAmount ?? 0), 0);
  });

  protected readonly todayCollectedCount = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return this.allTabs().filter(
      (t) => t.status === 'collected' && toMillis(t.collectedAt || t.updatedAt) >= todayMs,
    ).length;
  });

  // Filtered List
  protected readonly filteredTabs = computed(() => {
    const list = this.allTabs();
    const filter = this.statusFilter();
    const q = this.search().trim().toLowerCase();

    return list
      .filter((tab) => {
        const matchesStatus = filter === 'all' || tab.status === filter;
        if (!matchesStatus) return false;

        if (!q) return true;

        const noteMatch = (tab.note || '').toLowerCase().includes(q);
        const nameMatch = (tab.customerName || '').toLowerCase().includes(q);
        const itemMatch = (tab.items || []).some((i) =>
          (i.productName || '').toLowerCase().includes(q),
        );

        return noteMatch || nameMatch || itemMatch;
      })
      .sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
  });

  // Collect Modal State
  protected readonly selectedTabForCollect = signal<ExitPayment | null>(null);
  protected readonly collectPaymentMethod = signal<'cash' | 'card' | 'wallet' | 'transfer'>('cash');
  protected readonly collectAmount = signal<number>(0);
  protected readonly collectUserId = signal<string>('');
  protected readonly isCollecting = signal(false);

  // New Tab Modal State (Direct creation from this page)
  protected readonly showNewTabModal = signal(false);
  protected readonly newTabNote = signal('');
  protected readonly newTabCustomerName = signal('');
  protected readonly newTabUserId = signal('');
  protected readonly newTabAmount = signal<number>(0);
  protected readonly isCreatingTab = signal(false);

  // Edit Tab Modal State
  protected readonly selectedTabForEdit = signal<ExitPayment | null>(null);
  protected readonly editTabNote = signal('');
  protected readonly editTabCustomerName = signal('');
  protected readonly editTabAmount = signal<number>(0);
  protected readonly isEditingTab = signal(false);

  // Helper for Member details
  getMember(uid?: string | null): UserProfile | undefined {
    if (!uid) return undefined;
    return this.activeMembersPool().find((m) => m.uid === uid) || this.members().find((m) => m.uid === uid);
  }

  protected getInitials(name?: string): string {
    if (!name) return 'ÜY';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toLocaleUpperCase('tr');
    return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr');
  }

  protected toggleNewTabMemberDropdown(): void {
    const next = !this.memberDropdownOpen();
    this.memberDropdownOpen.set(next);
    if (next) {
      this.memberSearchQuery.set('');
    }
  }

  protected selectNewTabMember(uid: string): void {
    this.newTabUserId.set(uid);
    const m = this.getMember(uid);
    if (m) {
      this.newTabCustomerName.set(m.displayName);
    } else {
      this.newTabCustomerName.set('');
    }
    this.memberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  protected clearNewTabMember(event: Event): void {
    event.stopPropagation();
    this.newTabUserId.set('');
    this.newTabCustomerName.set('');
  }

  protected toggleCollectMemberDropdown(): void {
    const next = !this.collectMemberDropdownOpen();
    this.collectMemberDropdownOpen.set(next);
    if (next) {
      this.memberSearchQuery.set('');
    }
  }

  protected selectCollectMember(uid: string): void {
    this.collectUserId.set(uid);
    this.collectMemberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  // --- ACTIONS ---

  // 1. Collect Dialog
  openCollectModal(tab: ExitPayment): void {
    this.selectedTabForCollect.set(tab);
    this.collectAmount.set(tab.totalAmount);
    this.collectPaymentMethod.set('cash');
    this.collectUserId.set(tab.userId || '');
    this.collectMemberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
  }

  closeCollectModal(): void {
    this.selectedTabForCollect.set(null);
    this.collectMemberDropdownOpen.set(false);
  }

  async confirmCollect(): Promise<void> {
    const tab = this.selectedTabForCollect();
    if (!tab || this.isCollecting()) return;

    if (this.saasSub.isExpired()) {
      void this.alertService.error('SaaS Lisansı Süresi Doldu', 'İşlem gerçekleştirilemez.');
      return;
    }

    const method = this.collectPaymentMethod();
    const userId = this.collectUserId();

    if (method === 'wallet') {
      if (!userId) {
        this.alertService.toastWarning('E-Cüzdan ile tahsilat için lütfen bir müşteri seçin.');
        return;
      }
      const member = this.getMember(userId);
      if (member && (member.walletBalance ?? 0) < this.collectAmount()) {
        this.alertService.toastWarning(
          `Seçili üyenin cüzdan bakiyesi yetersiz (Bakiye: ${this.money(member.walletBalance || 0)}).`,
        );
        return;
      }
    }

    this.isCollecting.set(true);
    try {
      await this.exitPaymentsService.collectExitPayment(tab.id, {
        paymentMethod: method,
        totalAmount: this.collectAmount(),
        userId: userId || null,
      });

      this.closeCollectModal();
      this.alertService.toastSuccess(
        `Tahsilat Tamamlandı! ${this.money(this.collectAmount())} başarıyla kasaya işlendi.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tahsilat işlemi başarısız oldu.';
      this.alertService.toastError(msg);
    } finally {
      this.isCollecting.set(false);
    }
  }

  // 2. Cancel Dialog
  async confirmCancel(tab: ExitPayment): Promise<void> {
    if (this.saasSub.isExpired()) {
      void this.alertService.error('SaaS Lisansı Süresi Doldu', 'İşlem gerçekleştirilemez.');
      return;
    }

    const confirmed = await this.alertService.confirm({
      title: 'Fişi İptal Et',
      message: `"${tab.note}" açıklamalı ${this.money(tab.totalAmount)} tutarındaki açık fişi iptal etmek istediğinize emin misiniz? Varsa düşülen ürün stokları geri yüklenecektir.`,
      confirmText: 'Evet, İptal Et',
      cancelText: 'Vazgeç',
      isDestructive: true,
    });

    if (!confirmed) return;

    try {
      await this.exitPaymentsService.cancelExitPayment(tab.id);
      this.alertService.toastSuccess('Açık fiş iptal edildi ve stoklar iade edildi.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'İptal işlemi başarısız oldu.';
      this.alertService.toastError(msg);
    }
  }

  // 3. New Tab Modal
  openNewTabModal(): void {
    this.newTabNote.set('');
    this.newTabCustomerName.set('');
    this.newTabUserId.set('');
    this.newTabAmount.set(0);
    this.memberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
    this.showNewTabModal.set(true);
  }

  closeNewTabModal(): void {
    this.showNewTabModal.set(false);
    this.memberDropdownOpen.set(false);
  }

  async submitNewTab(): Promise<void> {
    const note = this.newTabNote().trim();
    if (!note) {
      this.alertService.toastWarning('Lütfen takip edebilmek için bir açıklama / not yazın.');
      return;
    }
    const amount = Number(this.newTabAmount());
    if (amount <= 0) {
      this.alertService.toastWarning('Lütfen geçerli bir tutar girin.');
      return;
    }

    this.isCreatingTab.set(true);
    try {
      const userId = this.newTabUserId();
      const member = this.getMember(userId);

      await this.exitPaymentsService.createExitPayment({
        note,
        customerName: member ? member.displayName : this.newTabCustomerName().trim() || 'Misafir / Anonim',
        userId: userId || null,
        totalAmount: amount,
        items: [
          {
            productName: note,
            quantity: 1,
            unitPrice: amount,
          },
        ],
      });

      this.closeNewTabModal();
      this.alertService.toastSuccess(`Yeni açık fiş oluşturuldu: ${this.money(amount)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kayıt oluşturulamadı.';
      this.alertService.toastError(msg);
    } finally {
      this.isCreatingTab.set(false);
    }
  }

  // 4. Edit Modal
  openEditModal(tab: ExitPayment): void {
    this.selectedTabForEdit.set(tab);
    this.editTabNote.set(tab.note);
    this.editTabCustomerName.set(tab.customerName || '');
    this.editTabAmount.set(tab.totalAmount);
  }

  closeEditModal(): void {
    this.selectedTabForEdit.set(null);
  }

  async submitEditTab(): Promise<void> {
    const tab = this.selectedTabForEdit();
    if (!tab || this.isEditingTab()) return;

    const note = this.editTabNote().trim();
    if (!note) {
      this.alertService.toastWarning('Açıklama alanı boş bırakılamaz.');
      return;
    }

    this.isEditingTab.set(true);
    try {
      await this.exitPaymentsService.updateExitPayment(tab.id, {
        note,
        customerName: this.editTabCustomerName().trim() || tab.customerName,
        totalAmount: Number(this.editTabAmount() || tab.totalAmount),
      });

      this.closeEditModal();
      this.alertService.toastSuccess('Açık fiş güncellendi.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Güncelleme yapılamadı.';
      this.alertService.toastError(msg);
    } finally {
      this.isEditingTab.set(false);
    }
  }
}
