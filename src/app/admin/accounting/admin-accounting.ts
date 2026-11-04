import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatDate, formatMoney, fromDateInput, sortDesc, toDateInput, todayInput } from '../../shared/ui/ui-utils';
import { AccountingCategory, AdminAccountingService } from './admin-accounting.service';
import { AccountingEntry } from '../../core/models/accounting-entry.model';
import { AdminEInvoiceService } from '../e-invoice/admin-e-invoice.service';
import { AdminMembersService } from '../members/admin-members.service';
import { UserProfile } from '../../core/models/user-profile.model';
import {
  GymDailyClosing,
  PreClosePreviewResponse,
  ExpenseAnalyticsResponse,
  BankPosClosing,
} from '../../core/models/daily-close.model';
import { GymBank } from '../../core/models/gym-bank.model';
import { GymBankService } from '../../core/services/gym-bank.service';
import { DailyCloseReminderService } from '../../core/services/daily-close-reminder.service';

type MainTab = 'ledger' | 'daily-close' | 'analytics';
type TypeFilter = 'all' | 'income' | 'expense';
type EntryType = AccountingEntry['type'];

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart / POS',
  transfer: 'Havale / EFT',
  wallet: 'E-Cüzdan',
};

import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field, TranslocoPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-accounting.html',
})
export class AdminAccounting implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminAccountingService);
  private readonly alertService = inject(AlertService);
  private readonly eInvoiceService = inject(AdminEInvoiceService);
  private readonly membersService = inject(AdminMembersService);
  private readonly gymBankService = inject(GymBankService);
  protected readonly reminderService = inject(DailyCloseReminderService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationCenter = inject(NotificationCenterService);

  // Active Main Tab
  protected readonly activeTab = signal<MainTab>('ledger');

  protected readonly filters: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'income', label: 'Gelir' },
    { id: 'expense', label: 'Gider' },
  ];
  protected readonly paymentLabel = PAYMENT_LABEL;
  protected readonly money = formatMoney;
  protected readonly date = formatDate;

  // -------------------------------------------------------------
  // TAB 1: LEDGER (KASA HAREKETLERİ)
  // -------------------------------------------------------------
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly monthFilter = signal('');

  private readonly data = toSignal(this.service.watchEntries(), { initialValue: null });
  protected readonly categories = toSignal(this.service.watchCategories(), { initialValue: [] as AccountingCategory[] });

  // E-Fatura & Üye Entegrasyonu
  protected readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  protected readonly eInvoiceConfig = toSignal(this.eInvoiceService.watchConfig(), { initialValue: null });
  protected readonly createWithInvoice = signal(false);
  protected readonly isMemberDropdownOpen = signal(false);
  protected readonly memberSearchQuery = signal('');
  protected readonly selectedMemberId = signal<string>('');
  protected readonly kdvRate = signal<number>(20);
  protected readonly isTaxIncluded = signal<boolean>(true);
  protected readonly invoiceProfile = signal<'EARSIVFATURA' | 'TICARIFATURA'>('EARSIVFATURA');

  protected readonly categoryModalOpen = signal(false);
  protected readonly savingCategory = signal(false);
  protected newCategoryName = '';
  protected newCategoryType: 'income' | 'expense' | 'both' = 'income';

  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<AccountingEntry | null>(null);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    type: ['income' as EntryType],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    category: ['', [Validators.required]],
    description: ['', [Validators.required]],
    entryDate: [todayInput(), [Validators.required]],
    paymentMethod: ['cash'],
    notes: [''],
    // Fatura Alanları
    invoiceNumber: [''],
    recipientName: [''],
    recipientVknOrTckn: [''],
    recipientTaxOffice: [''],
    recipientAddress: [''],
    recipientPhone: [''],
    recipientEmail: [''],
  });

  // -------------------------------------------------------------
  // TAB 2: GÜN SONU KAPANISI (Z RAPORU)
  // -------------------------------------------------------------
  protected readonly dailyCloseDate = signal(todayInput());
  protected readonly preClosePreview = signal<PreClosePreviewResponse | null>(null);
  protected readonly loadingPreClose = signal(false);
  protected readonly closingsHistory = signal<GymDailyClosing[]>([]);
  protected readonly loadingHistory = signal(false);

  protected readonly closeDrawerOpen = signal(false);
  protected readonly submittingClose = signal(false);
  protected readonly activeZReport = signal<GymDailyClosing | null>(null);
  protected readonly zReportModalOpen = signal(false);

  // Anlaşmalı Bankalar
  protected readonly banks = toSignal(this.gymBankService.watchBanks(), { initialValue: [] as GymBank[] });

  // Gün Sonu Reaktif Değerler & Banka POS Slipleri
  protected readonly actualCashCountedSignal = signal<number>(0);
  protected readonly bankPosSlips = signal<Record<string, BankPosClosing>>({});
  protected readonly bankPosList = computed(() => Object.values(this.bankPosSlips()));
  protected readonly totalActualPosCounted = computed(() => {
    return this.bankPosList().reduce((sum, s) => sum + (Number(s.actualPos) || 0), 0);
  });

  protected readonly closeForm = this.fb.nonNullable.group({
    actualCashCounted: [0, [Validators.required, Validators.min(0)]],
    actualPosCounted: [0],
    retainedCashForNextDay: [0, [Validators.min(0)]],
    bankDepositAmount: [0, [Validators.min(0)]],
    notes: [''],
  });

  protected readonly liveCashDiff = computed(() => {
    const preview = this.preClosePreview();
    if (!preview) return 0;
    const actual = this.actualCashCountedSignal();
    return Math.round((actual - preview.expectedCash) * 100) / 100;
  });

  protected readonly livePosDiff = computed(() => {
    const preview = this.preClosePreview();
    if (!preview) return 0;
    const actual = this.totalActualPosCounted();
    return Math.round((actual - preview.expectedPos) * 100) / 100;
  });

  // Gün Sonu Hatırlatıcı Ayarları Modal State
  protected readonly reminderModalOpen = signal(false);
  protected readonly isSavingReminder = signal(false);
  protected readonly reminderForm = this.fb.group({
    enabled: [true],
    reminderTime: ['22:00', [Validators.required]],
    channel: ['in_app' as 'in_app' | 'browser_push' | 'both'],
    notifyRoles: [['owner', 'manager']],
    daysOfWeek: [[1, 2, 3, 4, 5, 6, 7]],
    customMessage: [''],
  });

  // -------------------------------------------------------------
  // TAB 3: GİDER ANALİTİĞİ & RAPORLAR (P&L)
  // -------------------------------------------------------------
  protected readonly analyticsPeriod = signal<'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear'>('thisMonth');
  protected readonly expenseAnalytics = signal<ExpenseAnalyticsResponse | null>(null);
  protected readonly loadingAnalytics = signal(false);

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'daily-close' || tabParam === 'analytics') {
      this.activeTab.set(tabParam as MainTab);
    }
    this.service.seedDefaultCategoriesIfEmpty().catch(() => {});
    this.loadPreClosePreview();
    this.loadClosingsHistory();
    this.loadExpenseAnalytics();
  }

  // --- LEDGER COMPUTEDS ---
  protected readonly entries = computed(() => {
    const list = this.data();
    return list && sortDesc(list, (e) => e.entryDate);
  });

  private readonly inMonth = computed(() => {
    const month = this.monthFilter();
    const list = this.entries() ?? [];
    return month ? list.filter((e) => toDateInput(e.entryDate).startsWith(month)) : list;
  });

  protected readonly visible = computed(() => {
    const type = this.typeFilter();
    return type === 'all' ? this.inMonth() : this.inMonth().filter((e) => e.type === type);
  });

  protected readonly totals = computed(() => {
    let income = 0;
    let expense = 0;
    for (const e of this.inMonth()) e.type === 'income' ? (income += e.amount) : (expense += e.amount);
    return { income, expense, net: income - expense };
  });

  protected categoryOptions(): string[] {
    const selectedType = this.form.controls.type.value;
    const all = this.categories();
    if (all.length === 0) {
      return selectedType === 'income'
        ? ['Üyelik & Abonelik Satışı', 'Market & Ürün Satışı', 'Özel Ders (PT)', 'Diğer Gelir']
        : ['Salon Kirası', 'Personel Maaşları', 'Elektrik & Su & Isınma', 'Ekipman & Bakım', 'Diğer Gider'];
    }
    return all
      .filter((c) => c.type === selectedType || c.type === 'both')
      .map((c) => c.name);
  }

  protected err(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  // --- E-FATURA & MÜŞTERİ COMPUTED VE METODLARI ---
  protected readonly filteredMembers = computed(() => {
    const q = this.memberSearchQuery().toLowerCase().trim();
    const list = this.members() || [];
    if (!q) return list.slice(0, 30);
    return list
      .filter((m) =>
        (m.displayName || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q) ||
        (m.nationalId || '').includes(q),
      )
      .slice(0, 30);
  });

  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.uid === id) || null;
  });

  protected readonly calculatedNet = computed(() => {
    const amt = Number(this.form.controls.amount.value || 0);
    const rate = this.kdvRate();
    if (this.isTaxIncluded()) {
      return Math.round((amt / (1 + rate / 100)) * 100) / 100;
    }
    return amt;
  });

  protected readonly calculatedKdv = computed(() => {
    const amt = Number(this.form.controls.amount.value || 0);
    const rate = this.kdvRate();
    const net = this.calculatedNet();
    if (this.isTaxIncluded()) {
      return Math.round((amt - net) * 100) / 100;
    }
    return Math.round(((amt * rate) / 100) * 100) / 100;
  });

  protected readonly calculatedGrandTotal = computed(() => {
    if (this.isTaxIncluded()) {
      return Number(this.form.controls.amount.value || 0);
    }
    return this.calculatedNet() + this.calculatedKdv();
  });

  openFormWithInvoice(): void {
    this.openForm();
    this.createWithInvoice.set(true);
    this.generateNextInvoiceNumber();
  }

  quickCreateInvoiceForEntry(e: AccountingEntry): void {
    this.openForm(e);
    this.createWithInvoice.set(true);
    if (e.recipientName) {
      this.form.patchValue({ recipientName: e.recipientName });
    }
    if (e.recipientVknOrTckn) {
      this.form.patchValue({ recipientVknOrTckn: e.recipientVknOrTckn });
    }
    this.generateNextInvoiceNumber();
  }

  generateNextInvoiceNumber(): string {
    const cfg = this.eInvoiceConfig();
    const currentProvider = cfg?.provider || 'manuel';
    const prefix = cfg?.prefix || (currentProvider === 'gib_portal' ? 'GIB' : currentProvider === 'manuel' ? 'FAT' : 'ODV');
    const year = new Date().getFullYear();
    const autoNumber = `${prefix}${year}${String(Date.now()).slice(-9)}`;
    this.form.patchValue({ invoiceNumber: autoNumber });
    return autoNumber;
  }

  toggleCreateWithInvoice(): void {
    const nextVal = !this.createWithInvoice();
    this.createWithInvoice.set(nextVal);
    if (nextVal && !this.form.controls.invoiceNumber.value) {
      this.generateNextInvoiceNumber();
    }
  }

  selectMember(m: UserProfile): void {
    this.selectedMemberId.set(m.uid);
    this.form.patchValue({
      recipientName: m.displayName || '',
      recipientVknOrTckn: m.nationalId?.trim() || '11111111110',
      recipientPhone: m.phone || '',
      recipientEmail: m.email || '',
      recipientAddress: m.branchName ? `${m.branchName} Şubesi Üyesi` : 'Türkiye',
    });
    if (!this.form.controls.description.value) {
      this.form.patchValue({
        description: `${m.displayName} - ${m.packageLabel || 'Hizmet Bedeli'}`,
      });
    }
    this.closeMemberDropdown();
    this.alertService.toastSuccess(`"${m.displayName}" seçildi.`);
  }

  clearSelectedMember(): void {
    this.selectedMemberId.set('');
    this.form.patchValue({
      recipientName: '',
      recipientVknOrTckn: '',
      recipientPhone: '',
      recipientEmail: '',
      recipientAddress: '',
    });
  }

  toggleMemberDropdown(): void {
    this.isMemberDropdownOpen.update((v) => !v);
  }

  closeMemberDropdown(): void {
    this.isMemberDropdownOpen.set(false);
  }

  initials(name?: string): string {
    if (!name) return '??';
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected openForm(entry: AccountingEntry | null = null): void {
    this.editing.set(entry);
    this.errorMessage.set('');
    this.selectedMemberId.set('');
    this.isMemberDropdownOpen.set(false);
    this.memberSearchQuery.set('');
    this.createWithInvoice.set(false);
    this.kdvRate.set(20);
    this.isTaxIncluded.set(true);
    this.invoiceProfile.set('EARSIVFATURA');

    this.form.reset({
      type: entry?.type ?? (this.typeFilter() === 'expense' ? 'expense' : 'income'),
      amount: entry?.amount ?? 0,
      category: entry?.category ?? '',
      description: entry?.description ?? '',
      entryDate: entry ? toDateInput(entry.entryDate) : todayInput(),
      paymentMethod: entry?.paymentMethod ?? 'cash',
      notes: entry?.notes ?? '',
      invoiceNumber: entry?.invoiceNumber ?? '',
      recipientName: entry?.recipientName ?? '',
      recipientVknOrTckn: entry?.recipientVknOrTckn ?? '',
      recipientTaxOffice: '',
      recipientAddress: '',
      recipientPhone: '',
      recipientEmail: '',
    });
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    if (this.createWithInvoice()) {
      if (!v.recipientName?.trim()) {
        this.errorMessage.set('E-Fatura için lütfen Alıcı / Müşteri Adı giriniz.');
        return;
      }
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    try {
      let createdInvoiceId: string | undefined;
      let finalInvoiceNo: string | undefined;

      if (this.createWithInvoice()) {
        finalInvoiceNo = v.invoiceNumber?.trim() || this.generateNextInvoiceNumber();
        const tckn = v.recipientVknOrTckn?.trim() || '11111111110';
        const now = new Date();
        const issueTime = now.toTimeString().split(' ')[0];

        createdInvoiceId = await this.eInvoiceService.createInvoice({
          invoiceNumber: finalInvoiceNo,
          direction: v.type === 'expense' ? 'inbound' : 'outbound',
          recipientName: v.recipientName.trim(),
          recipientVknOrTckn: tckn,
          recipientTaxOffice: v.recipientTaxOffice?.trim() || undefined,
          recipientAddress: v.recipientAddress?.trim() || undefined,
          recipientPhone: v.recipientPhone?.trim() || undefined,
          recipientEmail: v.recipientEmail?.trim() || undefined,
          amount: this.calculatedNet(),
          discountTotal: 0,
          kdvRate: this.kdvRate(),
          kdvAmount: this.calculatedKdv(),
          totalAmount: this.calculatedGrandTotal(),
          invoiceType: this.invoiceProfile() === 'TICARIFATURA' ? 'commercial' : (v.type === 'expense' ? 'purchase' : 'earswive'),
          invoiceProfile: this.invoiceProfile(),
          invoiceTypeCode: 'SATIS',
          provider: this.eInvoiceConfig()?.provider || 'manuel',
          paymentMethod: (v.paymentMethod as any) || 'cash',
          paymentStatus: 'paid',
          isDeliveryNoteReplacement: true,
          issueTime,
          description: v.description.trim(),
          notes: v.notes ? `${v.notes} (Muhasebe Kaydı İle Otomatik Düzenlendi)` : 'Muhasebe kaydı ile otomatik düzenlendi.',
          memberId: this.selectedMemberId() || undefined,
          items: [
            {
              name: v.description.trim(),
              quantity: 1,
              unit: 'Adet',
              unitPrice: this.calculatedNet(),
              discountRate: 0,
              discountAmount: 0,
              kdvRate: this.kdvRate(),
              total: this.calculatedNet(),
              kdvAmount: this.calculatedKdv(),
              grandTotal: this.calculatedGrandTotal(),
            },
          ],
        });
      }

      const payload = {
        type: v.type,
        amount: v.amount,
        category: v.category.trim(),
        description: v.description.trim(),
        entryDate: fromDateInput(v.entryDate),
        paymentMethod: (v.paymentMethod || undefined) as AccountingEntry['paymentMethod'],
        notes: v.notes.trim(),
        invoiceId: createdInvoiceId,
        invoiceNumber: finalInvoiceNo,
        recipientName: v.recipientName?.trim() || undefined,
        recipientVknOrTckn: v.recipientVknOrTckn?.trim() || undefined,
        referenceId: createdInvoiceId,
        referenceType: (createdInvoiceId ? 'e-invoice' : undefined) as AccountingEntry['referenceType'],
      };

      const current = this.editing();
      if (current) {
        await this.service.updateEntry(current.id, payload);
      } else {
        await this.service.addEntry(payload);
      }

      if (this.createWithInvoice()) {
        this.alertService.toastSuccess(`✓ Muhasebe kaydı ve resmi e-faturası (${finalInvoiceNo}) başarıyla oluşturuldu!`);
      } else {
        this.alertService.toastSuccess(current ? 'Kayıt güncellendi.' : 'Muhasebe kaydı eklendi.');
      }

      this.close();
      this.loadPreClosePreview();
      this.loadExpenseAnalytics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kaydedilemedi, lütfen tekrar deneyin.';
      this.errorMessage.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(entry: AccountingEntry): Promise<void> {
    const ok = await this.alertService.deleteConfirm(entry.description, 'Bu muhasebe kaydı silinecektir.');
    if (!ok) return;
    try {
      await this.service.deleteEntry(entry.id);
      this.alertService.toastSuccess('Kayıt silindi.');
      this.loadPreClosePreview();
      this.loadExpenseAnalytics();
    } catch {
      this.alertService.toastError('Kayıt silinemedi, tekrar dene.');
    }
  }

  protected openCategoryModal(): void {
    this.newCategoryName = '';
    this.newCategoryType = this.form.controls.type.value === 'expense' ? 'expense' : 'income';
    this.categoryModalOpen.set(true);
  }

  protected closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
  }

  protected async saveNewCategory(): Promise<void> {
    if (!this.newCategoryName.trim()) {
      this.alertService.toastError('Lütfen kategori adını giriniz.');
      return;
    }
    this.savingCategory.set(true);
    try {
      await this.service.addCategory(this.newCategoryName.trim(), this.newCategoryType);
      this.alertService.toastSuccess('Kategori başarıyla eklendi.');
      this.form.controls.category.setValue(this.newCategoryName.trim());
      this.newCategoryName = '';
      this.closeCategoryModal();
    } catch (e: any) {
      this.alertService.toastError(e.message || 'Kategori eklenemedi.');
    } finally {
      this.savingCategory.set(false);
    }
  }

  protected async deleteCategory(cat: AccountingCategory): Promise<void> {
    if (!cat.id) return;
    const ok = await this.alertService.deleteConfirm(cat.name, 'Bu kategori silinecektir.');
    if (!ok) return;
    try {
      await this.service.deleteCategory(cat.id);
      this.alertService.toastSuccess('Kategori silindi.');
    } catch {
      this.alertService.toastError('Kategori silinemedi.');
    }
  }

  // -------------------------------------------------------------
  // TAB 2 METHODS: GÜN SONU KAPANISI & Z RAPORU
  // -------------------------------------------------------------
  protected async loadPreClosePreview(): Promise<void> {
    this.loadingPreClose.set(true);
    try {
      const res = await this.service.getDailyClosePreview(this.dailyCloseDate());
      this.preClosePreview.set(res);
    } catch {
      this.alertService.toastError('Gün sonu kasa verileri alınamadı.');
    } finally {
      this.loadingPreClose.set(false);
    }
  }

  protected async loadClosingsHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const list = await this.service.listDailyClosings(undefined, 30);
      this.closingsHistory.set(list);
    } catch {
      // Ignored
    } finally {
      this.loadingHistory.set(false);
    }
  }

  protected onDateChange(newDate: string): void {
    this.dailyCloseDate.set(newDate);
    this.loadPreClosePreview();
  }

  protected openDailyCloseDrawer(): void {
    const preview = this.preClosePreview();
    if (!preview) return;

    const existing = preview.existingClosing;
    const initialCash = existing ? existing.actualCashCounted : preview.expectedCash;
    const initialPos = existing ? existing.actualPosCounted : preview.expectedPos;

    this.closeForm.reset({
      actualCashCounted: initialCash,
      actualPosCounted: initialPos,
      retainedCashForNextDay: existing ? existing.retainedCashForNextDay : (preview.openingCash || 1000),
      bankDepositAmount: existing ? existing.bankDepositAmount : Math.max(0, (preview.expectedCash - (preview.openingCash || 1000))),
      notes: existing?.notes || '',
    });
    this.actualCashCountedSignal.set(initialCash);

    // Initialize Bank POS slips from active banks
    const posBanks = this.banks().filter(
      (b) => (b.hasPos || b.hasPosDevice) && (b.status === 'active' || b.isActive !== false),
    );

    const slipsMap: Record<string, BankPosClosing> = {};
    const existingBankClosings = existing?.bankPosClosings || [];

    if (posBanks.length > 0) {
      for (const b of posBanks) {
        const exist = existingBankClosings.find((x) => x.bankId === b.id);
        const expectedItem = preview.bankPosExpected?.find((x) => x.bankId === b.id);
        const expectedForBank = expectedItem?.expectedPos ?? 0;
        const actualForBank = exist ? exist.actualPos : (expectedForBank || 0);
        slipsMap[b.id] = {
          bankId: b.id,
          bankName: b.bankName || b.name || 'Banka',
          terminalNo: b.posTerminalNo,
          posTerminalNo: b.posTerminalNo,
          expectedPos: expectedForBank,
          actualPos: actualForBank,
          difference: Math.round((actualForBank - expectedForBank) * 100) / 100,
          isSlipPrinted: exist?.isSlipPrinted ?? false,
          slipNotes: exist?.slipNotes || '',
        };
      }
    } else if (existingBankClosings.length > 0) {
      for (const exist of existingBankClosings) {
        slipsMap[exist.bankId] = { ...exist };
      }
    }
    this.bankPosSlips.set(slipsMap);

    this.closeDrawerOpen.set(true);
  }

  protected onCashCountedChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value || 0);
    this.actualCashCountedSignal.set(val);
    this.closeForm.controls.actualCashCounted.setValue(val);
  }

  protected onBankPosSlipChange(bankId: string, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value || 0);
    const slips = { ...this.bankPosSlips() };
    if (!slips[bankId]) return;
    const expected = slips[bankId].expectedPos || 0;
    slips[bankId] = {
      ...slips[bankId],
      actualPos: val,
      difference: Math.round((val - expected) * 100) / 100,
    };
    this.bankPosSlips.set(slips);
    this.closeForm.controls.actualPosCounted.setValue(this.totalActualPosCounted());
  }

  protected onBankPosSlipPrintedToggle(bankId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const slips = { ...this.bankPosSlips() };
    if (!slips[bankId]) return;
    slips[bankId] = {
      ...slips[bankId],
      isSlipPrinted: checked,
    };
    this.bankPosSlips.set(slips);
  }

  protected onBankPosSlipNotesChange(bankId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    const slips = { ...this.bankPosSlips() };
    if (!slips[bankId]) return;
    slips[bankId] = {
      ...slips[bankId],
      slipNotes: val,
    };
    this.bankPosSlips.set(slips);
  }

  protected closeDailyCloseDrawer(): void {
    this.closeDrawerOpen.set(false);
  }

  protected async handleDailyCloseSubmit(): Promise<void> {
    if (this.closeForm.invalid || this.submittingClose()) {
      this.closeForm.markAllAsTouched();
      return;
    }
    this.submittingClose.set(true);
    try {
      const v = this.closeForm.getRawValue();
      const bankClosingsList = Object.values(this.bankPosSlips()).map((s) => ({
        bankId: s.bankId,
        bankName: s.bankName,
        posTerminalNo: s.posTerminalNo,
        expectedPos: s.expectedPos,
        actualPos: Number(s.actualPos) || 0,
        difference: Math.round(((Number(s.actualPos) || 0) - s.expectedPos) * 100) / 100,
        isSlipPrinted: Boolean(s.isSlipPrinted),
        slipNotes: s.slipNotes,
      }));

      const res = await this.service.submitDailyClose({
        date: this.dailyCloseDate(),
        actualCashCounted: this.actualCashCountedSignal(),
        actualPosCounted: this.totalActualPosCounted(),
        retainedCashForNextDay: Number(v.retainedCashForNextDay),
        bankDepositAmount: Number(v.bankDepositAmount),
        bankPosClosings: bankClosingsList,
        notes: v.notes.trim(),
      });
      this.alertService.toastSuccess(`Z Raporu oluşturuldu: ${res.closingNumber}`);
      this.notificationCenter.reload().catch(() => {});
      this.closeDailyCloseDrawer();
      await this.loadPreClosePreview();
      await this.loadClosingsHistory();
      this.viewZReport(res);
    } catch {
      this.alertService.toastError('Kasa kapatma işlemi tamamlanamadı.');
    } finally {
      this.submittingClose.set(false);
    }
  }

  protected viewZReport(closing: GymDailyClosing): void {
    this.activeZReport.set(closing);
    this.zReportModalOpen.set(true);
  }

  protected closeZReportModal(): void {
    this.zReportModalOpen.set(false);
    this.activeZReport.set(null);
  }

  protected async verifyZReport(closing: GymDailyClosing): Promise<void> {
    try {
      const updated = await this.service.verifyDailyClose(closing.id);
      this.alertService.toastSuccess(`${updated.closingNumber} onaylandı ve mühürlendi.`);
      await this.loadPreClosePreview();
      await this.loadClosingsHistory();
      if (this.activeZReport()?.id === closing.id) {
        this.activeZReport.set(updated);
      }
    } catch {
      this.alertService.toastError('Onaylama işlemi başarısız.');
    }
  }

  protected printThermalReceipt(closing: GymDailyClosing): void {
    const printWin = window.open('', '_blank', 'width=420,height=750');
    if (!printWin) {
      this.alertService.toastError('Yazdırma penceresi açılamadı. Lütfen tarayıcı popup iznini kontrol edin.');
      return;
    }

    const diffCash = closing.cashDifference;
    const diffStatus = diffCash === 0
      ? 'TAM MUTABIK (0,00 ₺)'
      : diffCash > 0
        ? `KASA FAZLASI (+${this.money(diffCash)})`
        : `KASA AÇIĞI (${this.money(diffCash)})`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Z Raporu - ${closing.closingNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            margin: 0;
            padding: 8px;
            width: 72mm;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .title { font-size: 15px; font-weight: 900; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 8px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .badge { border: 1px solid #000; padding: 2px 4px; display: inline-block; font-size: 10px; margin-top: 4px; }
          .sign-area { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; }
          .sign-box { border-top: 1px dotted #000; width: 45%; padding-top: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">ODIVON GYM</div>
          <div class="subtitle">GÜN SONU KASA MUTABAKATI & Z RAPORU</div>
          <div class="font-bold">${closing.closingNumber}</div>
          <div>Tarih: ${closing.date} | Saat: ${new Date(closing.closedAt).toLocaleTimeString('tr-TR')}</div>
          <div>Kapatan: ${closing.closedByStaffName}</div>
          ${closing.branchName ? `<div>Şube: ${closing.branchName}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>AÇILIŞ KASASI (DEVİR):</span>
          <span class="font-bold">${this.money(closing.openingCash)}</span>
        </div>

        <div class="divider"></div>
        <div class="font-bold">GÜNÜN GELİR / TAHSİLATLARI:</div>
        <div class="row">
          <span>- Nakit Tahsilat:</span>
          <span>${this.money(closing.incomeSummary.cash)}</span>
        </div>
        <div class="row">
          <span>- POS / Kredi Kartı:</span>
          <span>${this.money(closing.incomeSummary.posCard)}</span>
        </div>
        <div class="row">
          <span>- Havale / EFT:</span>
          <span>${this.money(closing.incomeSummary.bankTransfer)}</span>
        </div>
        <div class="row">
          <span>- Cüzdan / Diğer:</span>
          <span>${this.money(closing.incomeSummary.wallet)}</span>
        </div>
        <div class="row font-bold">
          <span>TOPLAM TAHSİLAT:</span>
          <span>${this.money(closing.incomeSummary.total)}</span>
        </div>

        <div class="divider"></div>
        <div class="font-bold">GÜNÜN GİDERLERİ:</div>
        <div class="row">
          <span>- Nakit Giderler:</span>
          <span>${this.money(closing.expenseSummary.cash)}</span>
        </div>
        <div class="row">
          <span>- Banka/Transfer Giderler:</span>
          <span>${this.money(closing.expenseSummary.bank)}</span>
        </div>
        <div class="row font-bold">
          <span>TOPLAM GİDER (${closing.expenseSummary.count} Adet):</span>
          <span>${this.money(closing.expenseSummary.total)}</span>
        </div>

        <div class="double-divider"></div>
        <div class="font-bold text-center">FİZİKİ KASA MUTABAKATI</div>
        <div class="row font-bold">
          <span>BEKLENEN KASA NAKDİ:</span>
          <span>${this.money(closing.expectedCash)}</span>
        </div>
        <div class="row font-bold">
          <span>SAYILAN FİZİKİ NAKİT:</span>
          <span>${this.money(closing.actualCashCounted)}</span>
        </div>
        <div class="row font-bold" style="font-size: 13px;">
          <span>KASA FARKI:</span>
          <span>${this.money(closing.cashDifference)}</span>
        </div>
        <div class="text-center font-bold" style="margin-top: 4px;">
          [ ${diffStatus} ]
        </div>

        <div class="divider"></div>
        <div class="font-bold text-center">POS SLİP MUTABAKATI</div>
        <div class="row">
          <span>Sistem POS Ciro:</span>
          <span>${this.money(closing.expectedPos)}</span>
        </div>
        <div class="row">
          <span>Sayılan POS Slipleri:</span>
          <span>${this.money(closing.actualPosCounted)}</span>
        </div>
        <div class="row font-bold">
          <span>POS Farkı:</span>
          <span>${this.money(closing.posDifference)}</span>
        </div>

        ${closing.bankPosClosings && closing.bankPosClosings.length > 0 ? `
          <div class="divider"></div>
          <div class="font-bold text-center">BANKA POS SLİPLERİ (Z RAPORLARI)</div>
          ${closing.bankPosClosings.map(b => `
            <div class="row">
              <span>${b.bankName} ${b.posTerminalNo ? '(' + b.posTerminalNo + ')' : ''}:</span>
              <span>${this.money(b.actualPos)} ${b.isSlipPrinted ? '[Z-OK]' : ''}</span>
            </div>
            ${b.difference !== 0 ? `<div class="row" style="font-size:10px;"><span>- Beklenen: ${this.money(b.expectedPos)}</span><span>Fark: ${b.difference > 0 ? '+' : ''}${this.money(b.difference)}</span></div>` : ''}
          `).join('')}
        ` : ''}

        <div class="divider"></div>
        <div class="row">
          <span>ERTESİ GÜNE DEVİR KASASI:</span>
          <span class="font-bold">${this.money(closing.retainedCashForNextDay)}</span>
        </div>
        <div class="row">
          <span>BANKAYA YATIRILACAK:</span>
          <span class="font-bold">${this.money(closing.bankDepositAmount)}</span>
        </div>

        ${closing.notes ? `
          <div class="divider"></div>
          <div><strong>Kapanış Notları:</strong> ${closing.notes}</div>
        ` : ''}

        ${closing.status === 'verified' ? `
          <div class="divider"></div>
          <div class="text-center font-bold" style="color: #000; border: 1px solid #000; padding: 4px;">
            YÖNETİCİ ONAYLI Z RAPORU<br/>
            Onaylayan: ${closing.verifiedByStaffName || 'Müdür'}
          </div>
        ` : ''}

        <div class="sign-area">
          <div class="sign-box">
            Kasa Görevlisi<br/><br/>İmza
          </div>
          <div class="sign-box">
            Salon Müdürü<br/><br/>İmza / Kaşe
          </div>
        </div>

        <div class="text-center" style="margin-top: 14px; font-size: 9px; color: #555;">
          ODIVON GYM BULUT SİSTEMİ İLE ÜRETİLMİŞTİR
        </div>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
  }

  // -------------------------------------------------------------
  // TAB 3 METHODS: GİDER & KÂRLILIK ANALİTİĞİ (P&L)
  // -------------------------------------------------------------
  protected async loadExpenseAnalytics(): Promise<void> {
    this.loadingAnalytics.set(true);
    try {
      const now = new Date();
      let startStr = '';
      let endStr = now.toISOString().slice(0, 10);

      const period = this.analyticsPeriod();
      if (period === 'thisMonth') {
        startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      } else if (period === 'lastMonth') {
        const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startStr = `${lastM.getFullYear()}-${String(lastM.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        endStr = lastDay.toISOString().slice(0, 10);
      } else if (period === 'last3Months') {
        const prev3 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        startStr = `${prev3.getFullYear()}-${String(prev3.getMonth() + 1).padStart(2, '0')}-01`;
      } else if (period === 'thisYear') {
        startStr = `${now.getFullYear()}-01-01`;
      }

      const res = await this.service.getExpenseAnalytics({ startDate: startStr, endDate: endStr });
      this.expenseAnalytics.set(res);
    } catch (err) {
      console.warn('Gider analitiği verileri alınamadı:', err);
    } finally {
      this.loadingAnalytics.set(false);
    }
  }

  protected setAnalyticsPeriod(period: 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear'): void {
    this.analyticsPeriod.set(period);
    this.loadExpenseAnalytics();
  }

  protected exportAnalyticsCsv(): void {
    const data = this.expenseAnalytics();
    if (!data) return;

    let csv = 'Kategori,Harcama Tutari (TL),Islem Sayisi,Harcama Payi (%)\r\n';
    for (const item of data.categoryBreakdown) {
      csv += `"${item.name}",${item.amount},${item.count},%${item.percentage}\r\n`;
    }
    csv += `\r\nGenel Finans Ozeti\r\n`;
    csv += `Toplam Gelir,${data.totalIncome}\r\n`;
    csv += `Toplam Gider,${data.totalExpense}\r\n`;
    csv += `Net Kar/Zarar,${data.netProfit}\r\n`;
    csv += `Gider Marji, %${data.expenseMarginPercentage}\r\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gider_Raporu_${data.startDate}_${data.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // -------------------------------------------------------------
  // GÜN SONU HATIRLATICI METODLARI
  // -------------------------------------------------------------
  protected async openReminderModal(): Promise<void> {
    try {
      await this.reminderService.loadSettings();
      const s = this.reminderService.settings();
      this.reminderForm.patchValue({
        enabled: s.enabled,
        reminderTime: s.reminderTime,
      });
      this.reminderModalOpen.set(true);
    } catch {
      this.reminderModalOpen.set(true);
    }
  }

  protected closeReminderModal(): void {
    this.reminderModalOpen.set(false);
  }

  protected async saveReminderSettings(): Promise<void> {
    if (this.reminderForm.invalid || this.isSavingReminder()) return;
    this.isSavingReminder.set(true);
    try {
      const v = this.reminderForm.value;
      await this.reminderService.saveSettings({
        enabled: v.enabled ?? true,
        reminderTime: v.reminderTime || '22:00',
        notifyInApp: true,
      });
      this.alertService.toastSuccess('Gün sonu hatırlatıcı ayarları kaydedildi.');
      this.closeReminderModal();
    } catch (e: any) {
      this.alertService.toastError(e.message || 'Ayarlar kaydedilemedi.');
    } finally {
      this.isSavingReminder.set(false);
    }
  }

  protected sendTestReminder(): void {
    this.reminderService.sendTestNotification();
    this.alertService.toastSuccess('Test bildirimi iletildi.');
  }
}
