import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminEInvoiceService } from './admin-e-invoice.service';
import {
  EInvoiceConfig,
  EInvoiceItem,
  InvoiceDirection,
  InvoiceLineItem,
  InvoiceProvider,
  InvoiceStatus,
  InvoiceType,
} from '../../core/models/e-invoice.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { formatMoney } from '../../shared/ui/ui-utils';

export interface FormLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  kdvRate: number;
}

const PROVIDERS = [
  { id: 'manuel' as InvoiceProvider, name: 'Manuel Fatura Girişi (Özel Entegratörsüz)', desc: 'Matbu veya kağıt faturalar, serbest muhasebe kayıtları' },
  { id: 'gib_portal' as InvoiceProvider, name: 'GİB Portal (Gelir İdaresi Başkanlığı Doğrudan)', desc: 'Doğrudan Gelir İdaresi e-arşiv portalı' },
  { id: 'uyumsoft' as InvoiceProvider, name: 'Uyumsoft Özel Entegratör', desc: 'Uyumsoft web servisleri ile tam otomatik e-dönüşüm' },
  { id: 'sovos_foriba' as InvoiceProvider, name: 'Sovos / Foriba Özel Entegratör', desc: 'Sovos e-fatura ve e-arşiv API entegrasyonu' },
  { id: 'qnb_efinans' as InvoiceProvider, name: 'QNB eFinans Özel Entegratör', desc: 'QNB Finansbank e-fatura portal web servisi' },
  { id: 'parasut' as InvoiceProvider, name: 'Paraşüt / Logo Entegrasyonu', desc: 'Bulut ön muhasebe API köprüsü' },
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Taslak',
  queued: 'Kuyrukta',
  signed: 'Onaylandı / Mühürlendi',
  sent: 'GİB’e İletildi',
  paid: 'Ödendi / Kapandı',
  rejected: 'Hata / İptal',
};

const STATUS_BADGES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  queued: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  signed: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  paid: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
};

const TYPE_LABELS: Record<InvoiceType, string> = {
  sales: 'Satış Faturası',
  purchase: 'Alış / Gider Faturası',
  earswive: 'E-Arşiv Fatura',
  commercial: 'Ticari E-Fatura',
  basic: 'Temel E-Fatura',
  refund: 'İade Faturası',
};

const PROVIDER_NAMES: Record<InvoiceProvider, string> = {
  manuel: 'Manuel Giriş',
  gib_portal: 'GİB Portal',
  uyumsoft: 'Uyumsoft',
  sovos_foriba: 'Sovos / Foriba',
  qnb_efinans: 'QNB eFinans',
  parasut: 'Paraşüt / Logo',
};

import { RouterLink } from '@angular/router';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

@Component({
  selector: 'app-admin-e-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-e-invoice.html',
})
export class AdminEInvoice {
  private readonly invoiceService = inject(AdminEInvoiceService);
  private readonly fb = inject(FormBuilder);
  private readonly alertService = inject(AlertService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly providers = PROVIDERS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusBadges = STATUS_BADGES;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly providerNames = PROVIDER_NAMES;
  protected readonly money = formatMoney;

  readonly config = toSignal(this.invoiceService.watchConfig(), { initialValue: null });
  readonly invoices = toSignal(this.invoiceService.watchInvoices(), { initialValue: [] as EInvoiceItem[] });

  readonly activeTab = signal<'invoices' | 'settings'>('invoices');
  readonly searchTerm = signal('');
  readonly directionFilter = signal<'all' | 'outbound' | 'inbound'>('all');
  readonly typeFilter = signal<'all' | string>('all');
  readonly seeding = signal(false);

  // Genel Fatura Oluşturma Çekmecesi (Slide-Over)
  readonly createDrawerOpen = signal(false);
  readonly submittingInvoice = signal(false);
  readonly invoiceError = signal('');

  // Fatura Önizleme / Yazdırma Modalı
  readonly selectedInvoiceForView = signal<EInvoiceItem | null>(null);

  // Çoklu Kalem Yönetimi
  readonly formLineItems = signal<FormLineItem[]>([
    { name: 'Salon Üyelik & Spor Hizmet Bedeli', quantity: 1, unitPrice: 1500, kdvRate: 20 },
  ]);

  readonly invoiceForm = this.fb.nonNullable.group({
    invoiceNumber: [''],
    direction: ['outbound' as InvoiceDirection, [Validators.required]],
    invoiceType: ['earswive' as InvoiceType, [Validators.required]],
    provider: ['manuel' as InvoiceProvider],
    issueDate: [new Date().toISOString().split('T')[0], [Validators.required]],
    recipientName: ['', [Validators.required, Validators.minLength(3)]],
    recipientVknOrTckn: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
    recipientTaxOffice: [''],
    recipientAddress: [''],
    paymentMethod: ['card' as 'cash' | 'card' | 'transfer' | 'open_account'],
    paymentStatus: ['paid' as 'paid' | 'pending'],
    notes: [''],
  });

  // Entegratör ve Firma Ayar Formu
  readonly savingConfig = signal(false);
  readonly configForm = this.fb.nonNullable.group({
    provider: ['manuel' as InvoiceProvider],
    companyTitle: ['ODİVON SPOR VE SAĞLIK HİZMETLERİ LTD. ŞTİ.'],
    companyVkn: ['7290184910'],
    taxOffice: ['Beşiktaş Vergi Dairesi'],
    address: ['Levent Mah. Cömert Sk. No: 12 Beşiktaş / İstanbul'],
    phone: ['0850 300 00 00'],
    email: ['muhasebe@odivongym.com'],
    username: [''],
    apiKey: [''],
    apiSecret: [''],
    webServiceUrl: [''],
    prefix: ['FAT'],
    isTestEnvironment: [true],
    autoSendOnPayment: [true],
  });

  constructor() {
    effect(() => {
      const cfg = this.config();
      if (cfg) {
        this.configForm.patchValue({
          provider: cfg.provider || 'manuel',
          companyTitle: cfg.companyTitle || 'ODİVON SPOR VE SAĞLIK HİZMETLERİ LTD. ŞTİ.',
          companyVkn: cfg.companyVkn || '7290184910',
          taxOffice: cfg.taxOffice || 'Beşiktaş Vergi Dairesi',
          address: cfg.address || 'Levent Mah. Cömert Sk. No: 12 Beşiktaş / İstanbul',
          phone: cfg.phone || '0850 300 00 00',
          email: cfg.email || 'muhasebe@odivongym.com',
          username: cfg.username || '',
          apiKey: cfg.apiKey || '',
          apiSecret: cfg.apiSecret || '',
          webServiceUrl: cfg.webServiceUrl || '',
          prefix: cfg.prefix || (cfg.provider === 'gib_portal' ? 'GIB' : cfg.provider === 'manuel' ? 'FAT' : 'ODV'),
          isTestEnvironment: cfg.isTestEnvironment ?? true,
          autoSendOnPayment: cfg.autoSendOnPayment ?? true,
        });
      }
    });
  }

  // Hesaplanan Kalem Toplamları
  readonly calcSubtotal = computed(() => {
    return this.formLineItems().reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  });

  readonly calcKdvTotal = computed(() => {
    return this.formLineItems().reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice * (item.kdvRate / 100)),
      0,
    );
  });

  readonly calcGrandTotal = computed(() => {
    return this.calcSubtotal() + this.calcKdvTotal();
  });

  // Filtrelenmiş Faturalar
  readonly filteredInvoices = computed(() => {
    let list = this.invoices();
    const term = this.searchTerm().trim().toLowerCase();
    const dir = this.directionFilter();
    const type = this.typeFilter();

    if (dir !== 'all') {
      list = list.filter((inv) => (inv.direction || 'outbound') === dir);
    }

    if (type !== 'all') {
      list = list.filter((inv) => inv.invoiceType === type);
    }

    if (term) {
      list = list.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(term) ||
          inv.recipientName.toLowerCase().includes(term) ||
          inv.recipientVknOrTckn.includes(term) ||
          inv.description?.toLowerCase().includes(term),
      );
    }

    return list;
  });

  // KPI Metrikleri
  readonly totalSalesAmount = computed(() => {
    return this.invoices()
      .filter((inv) => (inv.direction || 'outbound') === 'outbound')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  });

  readonly totalPurchaseAmount = computed(() => {
    return this.invoices()
      .filter((inv) => inv.direction === 'inbound')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  });

  readonly totalKdvAmount = computed(() => {
    return this.invoices().reduce((sum, inv) => sum + (inv.kdvAmount || 0), 0);
  });

  readonly activeProviderName = computed(() => {
    const p = this.config()?.provider || 'manuel';
    return this.providerNames[p] || 'Manuel Giriş';
  });

  // Kalem Satır İşlemleri
  addLineItem(): void {
    this.formLineItems.update((items) => [
      ...items,
      { name: '', quantity: 1, unitPrice: 0, kdvRate: 20 },
    ]);
  }

  removeLineItem(index: number): void {
    this.formLineItems.update((items) => {
      if (items.length <= 1) return items;
      return items.filter((_, i) => i !== index);
    });
  }

  updateLineItem(index: number, patch: Partial<FormLineItem>): void {
    this.formLineItems.update((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  openCreateDrawer(): void {
    if (this.saasSub.isExpired()) {
      void this.alertService.error(
        'SaaS Aboneliği Sona Erdi',
        'Salonunuzun SaaS lisansı sona erdiği için yeni E-Fatura veya E-Arşiv düzenlenemez. Lütfen SaaS Paket & Lisans menüsünden paketinizi yenileyiniz.',
      );
      return;
    }
    this.invoiceError.set('');
    const cfg = this.config();
    const currentProvider = cfg?.provider || 'manuel';

    this.invoiceForm.reset({
      invoiceNumber: '',
      direction: 'outbound',
      invoiceType: 'earswive',
      provider: currentProvider,
      issueDate: new Date().toISOString().split('T')[0],
      recipientName: '',
      recipientVknOrTckn: '',
      recipientTaxOffice: '',
      recipientAddress: '',
      paymentMethod: 'card',
      paymentStatus: 'paid',
      notes: '',
    });

    this.formLineItems.set([
      { name: 'Salon Üyelik & Spor Hizmet Bedeli', quantity: 1, unitPrice: 1500, kdvRate: 20 },
    ]);

    this.createDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    this.createDrawerOpen.set(false);
  }

  viewInvoice(inv: EInvoiceItem): void {
    this.selectedInvoiceForView.set(inv);
  }

  closeViewModal(): void {
    this.selectedInvoiceForView.set(null);
  }

  printInvoice(): void {
    window.print();
  }

  async submitInvoice(): Promise<void> {
    if (this.invoiceForm.invalid || this.submittingInvoice()) {
      this.invoiceForm.markAllAsTouched();
      this.invoiceError.set('Lütfen zorunlu alanları (Alıcı/Cari Adı, TCKN/VKN) eksiksiz doldurunuz.');
      return;
    }

    const items = this.formLineItems();
    if (items.length === 0 || items.some((it) => !it.name.trim() || it.unitPrice < 0)) {
      this.invoiceError.set('Lütfen en az bir geçerli fatura kalemi (açıklama ve fiyat) giriniz.');
      return;
    }

    this.submittingInvoice.set(true);
    this.invoiceError.set('');

    try {
      const v = this.invoiceForm.getRawValue();
      await this.invoiceService.createInvoice({
        invoiceNumber: v.invoiceNumber.trim() || undefined,
        direction: v.direction,
        recipientName: v.recipientName.trim(),
        recipientVknOrTckn: v.recipientVknOrTckn.trim(),
        recipientTaxOffice: v.recipientTaxOffice?.trim() || undefined,
        recipientAddress: v.recipientAddress?.trim() || undefined,
        amount: this.calcSubtotal(),
        kdvRate: items[0]?.kdvRate ?? 20,
        invoiceType: v.invoiceType,
        provider: v.provider,
        issueDate: v.issueDate,
        paymentMethod: v.paymentMethod,
        paymentStatus: v.paymentStatus,
        description: items[0]?.name || 'Fatura Kalemi',
        notes: v.notes.trim() || undefined,
        items: items.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          kdvRate: Number(it.kdvRate || 20),
          total: Number(it.quantity * it.unitPrice),
          kdvAmount: Number(it.quantity * it.unitPrice * (it.kdvRate / 100)),
          grandTotal: Number(it.quantity * it.unitPrice * (1 + it.kdvRate / 100)),
        })),
      });

      this.alertService.toastSuccess('✓ Fatura başarıyla kaydedildi.');
      this.closeCreateDrawer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fatura oluşturulamadı';
      this.invoiceError.set(msg);
    } finally {
      this.submittingInvoice.set(false);
    }
  }

  async saveIntegratorConfig(): Promise<void> {
    this.savingConfig.set(true);
    try {
      const v = this.configForm.getRawValue();
      await this.invoiceService.saveConfig(v as any);
      this.alertService.toastSuccess('✓ Entegratör ve fatura ayarları başarıyla güncellendi.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kaydedilemedi';
      this.alertService.toastError(`Hata: ${msg}`);
    } finally {
      this.savingConfig.set(false);
    }
  }

  async deleteInvoice(inv: EInvoiceItem): Promise<void> {
    const confirmed = await this.alertService.deleteConfirm(
      `${inv.invoiceNumber} (${inv.recipientName})`,
      'Faturayı Sil',
    );
    if (!confirmed) return;

    try {
      await this.invoiceService.deleteInvoice(inv.id);
      this.alertService.toastSuccess('Fatura kaydı silindi.');
    } catch {
      this.alertService.toastError('Fatura silinemedi.');
    }
  }

  async seedSampleInvoices(): Promise<void> {
    this.seeding.set(true);
    try {
      await this.invoiceService.seedSampleInvoices();
      this.alertService.toastSuccess('Örnek satış ve alış faturaları başarıyla yüklendi!');
    } catch {
      this.alertService.toastError('Örnek faturalar yüklenemedi.');
    } finally {
      this.seeding.set(false);
    }
  }

  formatDate(ts: any): string {
    if (!ts) return 'Bugün';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
