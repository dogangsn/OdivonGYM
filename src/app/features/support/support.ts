import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { SupportTicketApi } from '../../core/api/support-ticket.api';
import { SupportTicket, TicketPriority, TicketStatus } from '../../core/models/support-ticket.model';
import { BranchContextService } from '../../core/services/branch-context.service';

import { TranslocoPipe } from '@jsverse/transloco';

export interface TicketCategoryItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  badgeClass: string;
}

export const TICKET_CATEGORIES: TicketCategoryItem[] = [
  {
    id: 'technical_support',
    name: 'Teknik Destek & Sistem',
    desc: 'Uygulama, bağlantı, ekran donması veya yazılımsal sorunlar.',
    icon: 'build_circle',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'turnstile_access',
    name: 'Turnike & Geçiş Kontrol',
    desc: 'QR kod okumama, kart tanımlama, geçiş engeli ve turnike arızaları.',
    icon: 'qr_code_scanner',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'membership_freeze',
    name: 'Üyelik & Dondurma',
    desc: 'Üyelik süresi uzatma, paket dondurma, transfer veya iptal talepleri.',
    icon: 'ac_unit',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    id: 'billing_payment',
    name: 'Ödeme, Kasa & Fatura',
    desc: 'Taksit ödemeleri, kart çekimi, e-fatura sorgulama veya iade konuları.',
    icon: 'payments',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'feature_request',
    name: 'Öneri & Yeni İstek',
    desc: 'Salonda veya uygulamada görmek istediğiniz yeni fikirler.',
    icon: 'lightbulb',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'general_inquiry',
    name: 'Genel Soru & Bilgi',
    desc: 'Çalışma saatleri, grup dersleri veya antrenör seansları hakkında.',
    icon: 'help_outline',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'complaint_suggestion',
    name: 'Şikayet & Hizmet Bildirimi',
    desc: 'Hizmet kalitesi, salon düzeni veya personel ile ilgili geri bildirim.',
    icon: 'report_problem',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support.html',
  styleUrl: './support.scss',
})
export class Support implements OnInit {
  private readonly ticketApi = inject(SupportTicketApi);
  private readonly alert = inject(AlertService);
  protected readonly auth = inject(AuthService);
  private readonly branchContext = inject(BranchContextService);

  readonly categories = TICKET_CATEGORIES;

  readonly activeTab = signal<'create' | 'track' | 'history'>('create');

  // Form State
  readonly selectedCategory = signal<string>('technical_support');
  readonly subject = signal<string>('');
  readonly description = signal<string>('');
  readonly fullName = signal<string>('');
  readonly email = signal<string>('');
  readonly phone = signal<string>('');
  readonly priority = signal<TicketPriority>('normal');

  readonly isSubmitting = signal(false);
  readonly submittedTicket = signal<SupportTicket | null>(null);

  // Track State
  readonly searchTrackingNo = signal<string>('');
  readonly isSearching = signal(false);
  readonly trackedTicket = signal<SupportTicket | null>(null);
  readonly searchError = signal<string | null>(null);

  // History State
  readonly myTicketsList = signal<SupportTicket[]>([]);
  readonly isLoadingHistory = signal(false);

  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  ngOnInit(): void {
    const profile = this.auth.profile();
    if (profile) {
      this.fullName.set(profile.displayName || '');
      this.email.set(profile.email || '');
      this.phone.set(profile.phone || '');
    }
  }

  selectCategory(catId: string): void {
    this.selectedCategory.set(catId);
  }

  get selectedCategoryItem(): TicketCategoryItem {
    return this.categories.find((c) => c.id === this.selectedCategory()) || this.categories[0];
  }

  copyTrackingNumber(ticketNo?: string): void {
    const no = ticketNo || this.submittedTicket()?.trackingNumber || this.trackedTicket()?.trackingNumber;
    if (!no) return;
    void navigator.clipboard.writeText(no);
    this.alert.toastSuccess(`Takip numarası (${no}) panoya kopyalandı.`);
  }

  async pasteTrackingNumber(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.searchTrackingNo.set(text.trim());
      }
    } catch {
      // clipboard read restricted
    }
  }

  async submitTicket(): Promise<void> {
    const subject = this.subject().trim();
    const description = this.description().trim();
    const fullName = this.fullName().trim();
    const email = this.email().trim();

    if (!subject || !description || !fullName || !email) {
      this.alert.toastError('Lütfen zorunlu alanları (Ad Soyad, E-posta, Konu ve Açıklama) doldurun.');
      return;
    }

    if (description.length < 5) {
      this.alert.toastWarning('Lütfen talebinizi biraz daha detaylandırın (Açıklama en az 5 karakter olmalıdır).');
      return;
    }

    this.isSubmitting.set(true);
    try {
      const cat = this.selectedCategoryItem;
      const branch = this.branchContext.activeBranch();

      const created = await firstValueFrom(
        this.ticketApi.createTicket({
          category: cat.id,
          categoryLabel: cat.name,
          subject,
          description,
          fullName,
          email,
          phone: this.phone().trim() || undefined,
          priority: this.priority(),
          // Product tells the management panel which app the ticket came from.
          product: 'gym',
          tenantId: this.auth.profile()?.tenantId || branch?.tenantId || undefined,
          // MainAPI replaces this with the tenant's own name when it knows the tenant.
          tenantName: branch?.name || undefined,
        }),
      );

      this.submittedTicket.set(created);
      this.myTicketsList.update((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      this.alert.toastSuccess(`Talebiniz alındı! Takip No: ${created.trackingNumber}`);
      this.resetForm();
    } catch (err: any) {
      console.error('Talep oluşturma hatası:', err);
      const rawMsg = err?.error?.error?.message || err?.error?.message || err?.message;
      let displayMsg = 'Talep iletilirken bir hata oluştu. Lütfen tekrar deneyin.';
      if (Array.isArray(rawMsg)) {
        displayMsg = rawMsg.map((m: string) => {
          if (m.includes('description must be longer than')) return 'Açıklama alanı en az 5 karakter olmalıdır.';
          if (m.includes('email must be an email')) return 'Lütfen geçerli bir e-posta adresi girin.';
          return m;
        }).join('\n');
      } else if (typeof rawMsg === 'string') {
        if (rawMsg.includes('description must be longer than')) {
          displayMsg = 'Açıklama alanı en az 5 karakter olmalıdır.';
        } else if (rawMsg.includes('email must be an email')) {
          displayMsg = 'Lütfen geçerli bir e-posta adresi girin.';
        } else {
          displayMsg = rawMsg;
        }
      }
      this.alert.toastError(displayMsg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm(): void {
    this.subject.set('');
    this.description.set('');
    this.priority.set('normal');
  }

  startNewTicket(): void {
    this.submittedTicket.set(null);
    this.activeTab.set('create');
  }

  trackFromSubmitted(): void {
    const no = this.submittedTicket()?.trackingNumber;
    if (!no) return;
    this.searchTrackingNo.set(no);
    this.activeTab.set('track');
    void this.searchTicket();
  }

  async searchTicket(targetNo?: string): Promise<void> {
    const trackingNo = (targetNo || this.searchTrackingNo()).trim().toUpperCase();
    if (!trackingNo) {
      this.searchError.set('Lütfen geçerli bir takip numarası girin.');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set(null);
    this.trackedTicket.set(null);

    try {
      const ticket = await firstValueFrom(this.ticketApi.trackTicket(trackingNo));
      this.trackedTicket.set(ticket);
    } catch (err: any) {
      console.error('Takip sorgu hatası:', err);
      this.searchError.set('Belirtilen takip numarasına (' + trackingNo + ') ait talep bulunamadı.');
    } finally {
      this.isSearching.set(false);
    }
  }

  async loadMyTickets(): Promise<void> {
    this.isLoadingHistory.set(true);
    try {
      const email = this.auth.email() || this.email().trim() || undefined;
      const list = await firstValueFrom(this.ticketApi.myTickets(email));
      this.myTicketsList.set(list || []);
    } catch (err) {
      console.error('Geçmiş talepler yüklenemedi:', err);
      this.myTicketsList.set([]);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  viewTicketFromHistory(ticket: SupportTicket): void {
    this.trackedTicket.set(ticket);
    this.searchTrackingNo.set(ticket.trackingNumber);
    this.activeTab.set('track');
  }

  getStatusBadge(status: TicketStatus): { label: string; bg: string; text: string; icon: string; dot: string } {
    switch (status) {
      case 'pending':
        return { label: 'İnceleniyor', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', icon: 'hourglass_empty', dot: 'bg-amber-500' };
      case 'in_progress':
        return { label: 'İşleme Alındı', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'sync', dot: 'bg-blue-500' };
      case 'approved':
        return { label: 'Onaylandı', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', icon: 'thumb_up', dot: 'bg-indigo-500' };
      case 'completed':
        return { label: 'Tamamlandı & Çözüldü', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: 'check_circle', dot: 'bg-emerald-500' };
      case 'rejected':
        return { label: 'İptal / Reddedildi', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-800', icon: 'cancel', dot: 'bg-rose-500' };
      default:
        return { label: 'Bekliyor', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800', icon: 'info', dot: 'bg-slate-400' };
    }
  }

  getPriorityBadge(priority: TicketPriority): { label: string; class: string } {
    switch (priority) {
      case 'urgent':
        return { label: 'Acil', class: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'high':
        return { label: 'Yüksek', class: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'low':
        return { label: 'Düşük', class: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: 'Normal', class: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
  }
}
