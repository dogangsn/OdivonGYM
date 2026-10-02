import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import * as QRCode from 'qrcode';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminEInvoiceService } from './admin-e-invoice.service';
import { AdminMembersService } from '../members/admin-members.service';
import { AdminPackagesService } from '../packages/admin-packages.service';
import {
  EInvoiceConfig,
  EInvoiceItem,
  InvoiceDirection,
  InvoiceLineItem,
  InvoiceProvider,
  InvoiceStatus,
  InvoiceType,
} from '../../core/models/e-invoice.model';
import { UserProfile } from '../../core/models/user-profile.model';
import { GymPackage } from '../../core/models/gym-package.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { formatMoney } from '../../shared/ui/ui-utils';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';
import { downloadFile, generateGibQrCodePayload, generateUblTr21Xml, turkishNumberToWords } from './gib-ubl.helper';

export interface FormLineItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number; // Yüzde iskonto
  kdvRate: number; // %20, %10, %1, %0
}

const PROVIDERS = [
  { id: 'manuel' as InvoiceProvider, name: 'Manuel Fatura Girişi (Özel Entegratörsüz)', desc: 'Matbu veya kağıt faturalar, serbest muhasebe kayıtları' },
  { id: 'gib_portal' as InvoiceProvider, name: 'GİB Portal (Gelir İdaresi Başkanlığı Doğrudan)', desc: 'Doğrudan Gelir İdaresi e-arşiv portalı (UBL-TR formatı)' },
  { id: 'uyumsoft' as InvoiceProvider, name: 'Uyumsoft Özel Entegratör', desc: 'Uyumsoft web servisleri ile tam otomatik e-dönüşüm' },
  { id: 'sovos_foriba' as InvoiceProvider, name: 'Sovos / Foriba Özel Entegratör', desc: 'Sovos e-fatura ve e-arşiv API entegrasyonu' },
  { id: 'qnb_efinans' as InvoiceProvider, name: 'QNB eFinans Özel Entegratör', desc: 'QNB Finansbank e-fatura portal web servisi' },
  { id: 'parasut' as InvoiceProvider, name: 'Paraşüt / Logo Entegrasyonu', desc: 'Bulut ön muhasebe API köprüsü' },
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Taslak',
  queued: 'Kuyrukta',
  signed: 'İmzalandı / Mühürlendi',
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

@Component({
  selector: 'app-admin-e-invoice',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatTooltipModule,
    PageHeader,
    SlideOver,
    Field,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-e-invoice.html',
  styleUrl: './admin-e-invoice.scss',
})
export class AdminEInvoice {
  private readonly invoiceService = inject(AdminEInvoiceService);
  private readonly membersService = inject(AdminMembersService);
  private readonly packagesService = inject(AdminPackagesService);
  private readonly fb = inject(FormBuilder);
  private readonly alertService = inject(AlertService);
  protected readonly saasSub = inject(SaasSubscriptionService);

  protected readonly providers = PROVIDERS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusBadges = STATUS_BADGES;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly providerNames = PROVIDER_NAMES;
  protected readonly money = formatMoney;
  protected readonly words = turkishNumberToWords;

  readonly config = toSignal(this.invoiceService.watchConfig(), { initialValue: null });
  readonly invoices = toSignal(this.invoiceService.watchInvoices(), { initialValue: [] as EInvoiceItem[] });
  readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  readonly packages = toSignal(this.packagesService.watchPackages(), { initialValue: [] as GymPackage[] });

  readonly activeTab = signal<'invoices' | 'settings'>('invoices');
  readonly searchTerm = signal('');
  readonly directionFilter = signal<'all' | 'outbound' | 'inbound'>('all');
  readonly typeFilter = signal<'all' | string>('all');
  readonly seeding = signal(false);

  // Genel Fatura Oluşturma Çekmecesi (Slide-Over)
  readonly createDrawerOpen = signal(false);
  readonly submittingInvoice = signal(false);
  readonly invoiceError = signal('');
  readonly selectedMemberId = signal<string>('');

  // Fatura Önizleme / GİB Standart Görüntüleyici Modalı
  readonly selectedInvoiceForView = signal<EInvoiceItem | null>(null);
  readonly qrCodeDataUrl = signal<string>('');
  readonly updatingStatus = signal(false);

  // Çoklu Kalem Yönetimi
  readonly formLineItems = signal<FormLineItem[]>([
    { name: 'Salon Üyelik & Spor Hizmet Bedeli', quantity: 1, unit: 'Ay', unitPrice: 1500, discountRate: 0, kdvRate: 20 },
  ]);

  readonly invoiceForm = this.fb.nonNullable.group({
    invoiceNumber: [''],
    prefix: ['GIB'],
    direction: ['outbound' as InvoiceDirection, [Validators.required]],
    invoiceType: ['earswive' as InvoiceType, [Validators.required]],
    invoiceProfile: ['EARSIVFATURA' as 'EARSIVFATURA' | 'TICARIFATURA' | 'TEMELFATURA' | 'KAMU' | 'IHRACAT'],
    invoiceTypeCode: ['SATIS' as 'SATIS' | 'IADE' | 'TEVKIFAT' | 'ISTISNA' | 'OZELMATRAH'],
    provider: ['manuel' as InvoiceProvider],
    issueDate: [new Date().toISOString().split('T')[0], [Validators.required]],
    issueTime: [new Date().toTimeString().split(' ')[0]],
    recipientName: ['', [Validators.required, Validators.minLength(3)]],
    recipientVknOrTckn: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
    recipientTaxOffice: [''],
    recipientAddress: [''],
    recipientDistrict: [''],
    recipientCity: [''],
    recipientPhone: [''],
    recipientEmail: [''],
    paymentMethod: ['card' as 'cash' | 'card' | 'transfer' | 'open_account'],
    paymentStatus: ['paid' as 'paid' | 'pending'],
    isDeliveryNoteReplacement: [true],
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
    mersisNo: ['0729018491000001'],
    tradeRegistryNo: ['542190'],
    website: ['www.odivongym.com'],
    iban: ['TR44 0006 2000 0001 2901 8491 01'],
    username: [''],
    apiKey: [''],
    apiSecret: [''],
    webServiceUrl: [''],
    prefix: ['GIB'],
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
          mersisNo: cfg.mersisNo || '0729018491000001',
          tradeRegistryNo: cfg.tradeRegistryNo || '542190',
          website: cfg.website || 'www.odivongym.com',
          iban: cfg.iban || 'TR44 0006 2000 0001 2901 8491 01',
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
    return this.formLineItems().reduce((sum, item) => {
      const gross = (item.quantity || 1) * (item.unitPrice || 0);
      const discount = gross * ((item.discountRate || 0) / 100);
      return sum + (gross - discount);
    }, 0);
  });

  readonly calcDiscountTotal = computed(() => {
    return this.formLineItems().reduce((sum, item) => {
      const gross = (item.quantity || 1) * (item.unitPrice || 0);
      return sum + (gross * ((item.discountRate || 0) / 100));
    }, 0);
  });

  readonly calcKdvTotal = computed(() => {
    return this.formLineItems().reduce((sum, item) => {
      const gross = (item.quantity || 1) * (item.unitPrice || 0);
      const net = gross - (gross * ((item.discountRate || 0) / 100));
      return sum + (net * ((item.kdvRate || 0) / 100));
    }, 0);
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
          (inv.gibUuid && inv.gibUuid.toLowerCase().includes(term)) ||
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
      { name: '', quantity: 1, unit: 'Adet', unitPrice: 0, discountRate: 0, kdvRate: 20 },
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

  // Üye Seçildiğinde Formu Otomatik Doldurma
  onMemberSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const uid = select.value;
    this.selectedMemberId.set(uid);
    if (!uid) return;

    const m = this.members().find((mem) => mem.uid === uid);
    if (!m) return;

    this.invoiceForm.patchValue({
      recipientName: m.displayName || '',
      recipientVknOrTckn: m.nationalId || '',
      recipientPhone: m.phone || '',
      recipientEmail: m.email || '',
      recipientAddress: m.branchName ? `${m.branchName} Şubesi Kayıtlı Üyesi` : 'Türkiye',
    });

    // Otomatik paket kalemi ekleme teklifi veya ekleme
    if (m.packageLabel) {
      this.formLineItems.set([
        {
          name: `${m.packageLabel} Spor & Fitness Üyeliği`,
          quantity: 1,
          unit: 'Paket',
          unitPrice: m.packagePrice || 1500,
          discountRate: 0,
          kdvRate: 20,
        },
      ]);
    }
  }

  // Hızlı Paket Ekleme
  addGymPackageToLines(pkgId: string): void {
    if (!pkgId) return;
    const pkg = this.packages().find((p) => p.id === pkgId);
    if (!pkg) return;

    this.formLineItems.update((items) => [
      ...items,
      {
        name: `${pkg.name} (${pkg.durationDays} Günlük Üyelik)`,
        quantity: 1,
        unit: 'Paket',
        unitPrice: pkg.price || 0,
        discountRate: 0,
        kdvRate: 20,
      },
    ]);
    this.alertService.toastSuccess(`"${pkg.name}" kalemi eklendi.`);
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
    this.selectedMemberId.set('');
    const cfg = this.config();
    const currentProvider = cfg?.provider || 'manuel';
    const prefix = cfg?.prefix || (currentProvider === 'gib_portal' ? 'GIB' : currentProvider === 'manuel' ? 'FAT' : 'ODV');
    const now = new Date();
    const year = now.getFullYear();
    const autoNumber = `${prefix}${year}${String(Date.now()).slice(-9)}`;

    this.invoiceForm.reset({
      invoiceNumber: autoNumber,
      prefix,
      direction: 'outbound',
      invoiceType: 'earswive',
      invoiceProfile: 'EARSIVFATURA',
      invoiceTypeCode: 'SATIS',
      provider: currentProvider,
      issueDate: now.toISOString().split('T')[0],
      issueTime: now.toTimeString().split(' ')[0],
      recipientName: '',
      recipientVknOrTckn: '',
      recipientTaxOffice: '',
      recipientAddress: '',
      recipientDistrict: '',
      recipientCity: 'İstanbul',
      recipientPhone: '',
      recipientEmail: '',
      paymentMethod: 'card',
      paymentStatus: 'paid',
      isDeliveryNoteReplacement: true,
      notes: 'İşbu e-Arşiv faturanın kağıt çıktısı irsaliye yerine geçer.',
    });

    this.formLineItems.set([
      { name: 'Salon Üyelik & Spor Hizmet Bedeli', quantity: 1, unit: 'Ay', unitPrice: 1500, discountRate: 0, kdvRate: 20 },
    ]);

    this.createDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    this.createDrawerOpen.set(false);
  }

  // GİB Standart Fatura Görüntüleyici Açma
  viewInvoice(inv: EInvoiceItem): void {
    this.selectedInvoiceForView.set(inv);
    // GİB Karekod Metni ve QR kod üretimi
    const qrPayload = generateGibQrCodePayload(inv, this.config());
    QRCode.toDataURL(qrPayload, {
      width: 130,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url: string) => this.qrCodeDataUrl.set(url))
      .catch((err: unknown) => {
        console.error('QR code generation error', err);
        this.qrCodeDataUrl.set('');
      });
  }

  closeViewModal(): void {
    this.selectedInvoiceForView.set(null);
    this.qrCodeDataUrl.set('');
  }

  printInvoice(): void {
    window.print();
  }

  // UBL-TR 2.1 XML İndirme
  downloadUblXml(inv: EInvoiceItem): void {
    const xml = generateUblTr21Xml(inv, this.config());
    const fileName = `${inv.invoiceNumber || 'GIB2026000000001'}.xml`;
    downloadFile(xml, fileName, 'application/xml;charset=utf-8');
    this.alertService.toastSuccess(`✓ ${fileName} UBL-TR XML formatında indirildi.`);
  }

  // Faturayı Mühürle ve GİB'e Gönder (Statü geçişi)
  async signAndSendToGib(inv: EInvoiceItem): Promise<void> {
    this.updatingStatus.set(true);
    try {
      await this.invoiceService.updateInvoice(inv.id, {
        status: 'sent',
      });
      // Güncel faturayı modalda güncelle
      this.selectedInvoiceForView.set({
        ...inv,
        status: 'sent',
      });
      this.alertService.toastSuccess('✓ Fatura mali mühür ile onaylandı ve GİB Portal kuyruğuna iletildi.');
    } catch {
      this.alertService.toastError('Fatura durumu güncellenemedi.');
    } finally {
      this.updatingStatus.set(false);
    }
  }

  // Müşteriye E-Posta Gönderme Simülasyonu
  async sendInvoiceEmail(inv: EInvoiceItem): Promise<void> {
    const email = inv.recipientEmail || this.config()?.email;
    if (!email) {
      this.alertService.toastError('Alıcıya ait kayıtlı bir e-posta adresi bulunamadı.');
      return;
    }
    const confirmed = await this.alertService.confirm({
      title: 'E-Posta Gönderilsin mi?',
      message: `Fatura PDF ve XML bağlantısı "${email}" adresine iletilecektir. Onaylıyor musunuz?`,
      confirmText: 'Evet, Gönder',
      cancelText: 'Vazgeç',
      icon: 'question',
    });
    if (confirmed) {
      this.alertService.toastSuccess(`✓ Fatura başarıyla ${email} adresine gönderildi.`);
    }
  }

  async submitInvoice(): Promise<void> {
    if (this.invoiceForm.invalid || this.submittingInvoice()) {
      this.invoiceForm.markAllAsTouched();
      this.invoiceError.set('Lütfen zorunlu alanları (Alıcı/Cari Adı, 10-11 haneli TCKN/VKN) eksiksiz doldurunuz.');
      return;
    }

    const items = this.formLineItems();
    if (items.length === 0 || items.some((it) => !it.name.trim() || it.unitPrice < 0)) {
      this.invoiceError.set('Lütfen en az bir geçerli fatura kalemi (açıklama ve tutar) giriniz.');
      return;
    }

    this.submittingInvoice.set(true);
    this.invoiceError.set('');

    try {
      const v = this.invoiceForm.getRawValue();
      const subtotal = this.calcSubtotal();
      const discountTotal = this.calcDiscountTotal();

      const lineItems: InvoiceLineItem[] = items.map((it) => {
        const gross = (it.quantity || 1) * (it.unitPrice || 0);
        const disc = gross * ((it.discountRate || 0) / 100);
        const net = gross - disc;
        const kdv = net * ((it.kdvRate || 0) / 100);
        return {
          name: it.name.trim(),
          quantity: Number(it.quantity || 1),
          unit: it.unit || 'Adet',
          unitPrice: Number(it.unitPrice || 0),
          discountRate: Number(it.discountRate || 0),
          discountAmount: Number(disc),
          kdvRate: Number(it.kdvRate || 20),
          total: Number(net),
          kdvAmount: Number(kdv),
          grandTotal: Number(net + kdv),
        };
      });

      await this.invoiceService.createInvoice({
        invoiceNumber: v.invoiceNumber.trim() || undefined,
        direction: v.direction,
        recipientName: v.recipientName.trim(),
        recipientVknOrTckn: v.recipientVknOrTckn.trim(),
        recipientTaxOffice: v.recipientTaxOffice?.trim() || undefined,
        recipientAddress: v.recipientAddress?.trim() || undefined,
        recipientDistrict: v.recipientDistrict?.trim() || undefined,
        recipientCity: v.recipientCity?.trim() || undefined,
        recipientPhone: v.recipientPhone?.trim() || undefined,
        recipientEmail: v.recipientEmail?.trim() || undefined,
        amount: subtotal,
        discountTotal,
        kdvRate: items[0]?.kdvRate ?? 20,
        invoiceType: v.invoiceType,
        invoiceProfile: v.invoiceProfile,
        invoiceTypeCode: v.invoiceTypeCode,
        provider: v.provider,
        issueDate: v.issueDate,
        issueTime: v.issueTime,
        currency: 'TRY',
        paymentMethod: v.paymentMethod,
        paymentStatus: v.paymentStatus,
        isDeliveryNoteReplacement: v.isDeliveryNoteReplacement,
        description: items[0]?.name || 'Fatura Kalemi',
        notes: v.notes.trim() || undefined,
        memberId: this.selectedMemberId() || undefined,
        items: lineItems,
      });

      this.alertService.toastSuccess('✓ Fatura başarıyla oluşturuldu ve GİB standartlarında kaydedildi.');
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
      this.alertService.toastSuccess('✓ Entegratör ve resmi fatura ayarları başarıyla güncellendi.');
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
      this.alertService.toastSuccess('GİB uyumlu örnek satış ve alış faturaları başarıyla yüklendi!');
    } catch {
      this.alertService.toastError('Örnek faturalar yüklenemedi.');
    } finally {
      this.seeding.set(false);
    }
  }

  formatDate(ts: any): string {
    if (!ts) return 'Bugün';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(ts: any, customTime?: string): string {
    if (customTime) return customTime;
    if (!ts) return '12:00:00';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
