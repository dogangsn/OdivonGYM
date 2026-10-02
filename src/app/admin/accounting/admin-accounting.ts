import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../core/services/alert.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatDate, formatMoney, fromDateInput, sortDesc, toDateInput, todayInput } from '../../shared/ui/ui-utils';
import { AccountingCategory, AdminAccountingService } from './admin-accounting.service';
import { AccountingEntry } from '../../core/models/accounting-entry.model';
import {
  GymDailyClosing,
  PreClosePreviewResponse,
  ExpenseAnalyticsResponse,
} from '../../core/models/daily-close.model';

type MainTab = 'ledger' | 'daily-close' | 'analytics';
type TypeFilter = 'all' | 'income' | 'expense';
type EntryType = AccountingEntry['type'];

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart / POS',
  transfer: 'Havale / EFT',
  wallet: 'E-Cüzdan',
};

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-accounting.html',
})
export class AdminAccounting implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminAccountingService);
  private readonly alertService = inject(AlertService);

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
    paymentMethod: [''],
    notes: [''],
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
    const actual = Number(this.closeForm.controls.actualCashCounted.value || 0);
    return Math.round((actual - preview.expectedCash) * 100) / 100;
  });

  protected readonly livePosDiff = computed(() => {
    const preview = this.preClosePreview();
    if (!preview) return 0;
    const actual = Number(this.closeForm.controls.actualPosCounted.value || 0);
    return Math.round((actual - preview.expectedPos) * 100) / 100;
  });

  // -------------------------------------------------------------
  // TAB 3: GİDER ANALİTİĞİ & RAPORLAR (P&L)
  // -------------------------------------------------------------
  protected readonly analyticsPeriod = signal<'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear'>('thisMonth');
  protected readonly expenseAnalytics = signal<ExpenseAnalyticsResponse | null>(null);
  protected readonly loadingAnalytics = signal(false);

  ngOnInit(): void {
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

  protected openForm(entry: AccountingEntry | null = null): void {
    this.editing.set(entry);
    this.errorMessage.set('');
    this.form.reset({
      type: entry?.type ?? (this.typeFilter() === 'expense' ? 'expense' : 'income'),
      amount: entry?.amount ?? 0,
      category: entry?.category ?? '',
      description: entry?.description ?? '',
      entryDate: entry ? toDateInput(entry.entryDate) : todayInput(),
      paymentMethod: entry?.paymentMethod ?? '',
      notes: entry?.notes ?? '',
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
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      const payload = {
        type: v.type,
        amount: v.amount,
        category: v.category.trim(),
        description: v.description.trim(),
        entryDate: fromDateInput(v.entryDate),
        paymentMethod: (v.paymentMethod || undefined) as AccountingEntry['paymentMethod'],
        notes: v.notes.trim(),
      };
      const current = this.editing();
      if (current) {
        await this.service.updateEntry(current.id, payload);
      } else {
        await this.service.addEntry(payload);
      }
      this.alertService.toastSuccess(current ? 'Kayıt güncellendi.' : 'Muhasebe kaydı eklendi.');
      this.close();
      this.loadPreClosePreview();
      this.loadExpenseAnalytics();
    } catch {
      this.errorMessage.set('Kaydedilemedi, lütfen tekrar deneyin.');
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
    this.closeForm.reset({
      actualCashCounted: existing ? existing.actualCashCounted : preview.expectedCash,
      actualPosCounted: existing ? existing.actualPosCounted : preview.expectedPos,
      retainedCashForNextDay: existing ? existing.retainedCashForNextDay : (preview.openingCash || 1000),
      bankDepositAmount: existing ? existing.bankDepositAmount : Math.max(0, (preview.expectedCash - (preview.openingCash || 1000))),
      notes: existing?.notes || '',
    });
    this.closeDrawerOpen.set(true);
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
      const res = await this.service.submitDailyClose({
        date: this.dailyCloseDate(),
        actualCashCounted: Number(v.actualCashCounted),
        actualPosCounted: Number(v.actualPosCounted),
        retainedCashForNextDay: Number(v.retainedCashForNextDay),
        bankDepositAmount: Number(v.bankDepositAmount),
        notes: v.notes.trim(),
      });
      this.alertService.toastSuccess(`Z Raporu oluşturuldu: ${res.closingNumber}`);
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
    } catch {
      this.alertService.toastError('Gider analitiği verileri alınamadı.');
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
}
