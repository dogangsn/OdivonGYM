import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminEInvoiceService } from './admin-e-invoice.service';
import { EInvoiceConfig, EInvoiceItem, InvoiceStatus, InvoiceType } from '../../core/models/e-invoice.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { formatMoney } from '../../shared/ui/ui-utils';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Taslak',
  queued: 'Kuyrukta',
  signed: 'İmzalandı',
  sent: 'GİB’e İletildi',
  rejected: 'Hata / Red',
};

const STATUS_BADGES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  queued: 'bg-amber-50 text-amber-700 border-amber-200',
  signed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

@Component({
  selector: 'app-admin-e-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-e-invoice.html',
})
export class AdminEInvoice {
  private readonly invoiceService = inject(AdminEInvoiceService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusBadges = STATUS_BADGES;
  protected readonly money = formatMoney;

  readonly config = toSignal(this.invoiceService.watchConfig(), { initialValue: null });
  readonly invoices = toSignal(this.invoiceService.watchInvoices(), { initialValue: [] as EInvoiceItem[] });

  readonly activeTab = signal<'invoices' | 'settings'>('invoices');
  readonly searchTerm = signal('');

  // Manuel fatura oluşturma çekmecesi
  readonly createDrawerOpen = signal(false);
  readonly submittingInvoice = signal(false);
  readonly invoiceError = signal('');

  readonly invoiceForm = this.fb.nonNullable.group({
    recipientName: ['', [Validators.required, Validators.minLength(3)]],
    recipientVknOrTckn: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
    amount: [1500, [Validators.required, Validators.min(1)]],
    kdvRate: [20],
    invoiceType: ['earswive' as InvoiceType],
    description: ['Salon Üyelik ve Spor Hizmet Bedeli'],
  });

  // Uyumsoft Ayar Formu
  readonly savingConfig = signal(false);
  readonly configForm = this.fb.nonNullable.group({
    provider: ['uyumsoft'],
    username: ['odivongym_uyum'],
    companyTitle: ['Odivon Spor ve Yaşam Hizmetleri Ltd. Şti.'],
    companyVkn: ['7290184910'],
    apiKey: ['uyum_live_sec_8921893712893'],
    prefix: ['UYM'],
    isTestEnvironment: [true],
    autoSendOnPayment: [true],
  });

  readonly filteredInvoices = computed(() => {
    const list = this.invoices();
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.recipientName.toLowerCase().includes(term) ||
        inv.recipientVknOrTckn.includes(term),
    );
  });

  readonly totalInvoicedAmount = computed(() => {
    return this.invoices().reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  });

  openCreateDrawer(): void {
    this.invoiceError.set('');
    this.invoiceForm.reset({
      recipientName: '',
      recipientVknOrTckn: '',
      amount: 1500,
      kdvRate: 20,
      invoiceType: 'earswive',
      description: 'Salon Üyelik ve Spor Hizmet Bedeli',
    });
    this.createDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    this.createDrawerOpen.set(false);
  }

  async submitInvoice(): Promise<void> {
    if (this.invoiceForm.invalid || this.submittingInvoice()) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    this.submittingInvoice.set(true);
    this.invoiceError.set('');
    try {
      const v = this.invoiceForm.getRawValue();
      await this.invoiceService.createInvoice({
        recipientName: v.recipientName.trim(),
        recipientVknOrTckn: v.recipientVknOrTckn.trim(),
        amount: Number(v.amount),
        kdvRate: Number(v.kdvRate),
        invoiceType: v.invoiceType,
        description: v.description.trim(),
      });
      this.snackBar.open('✓ E-Fatura oluşturuldu ve Uyumsoft GİB portalına iletildi.', 'Kapat', { duration: 3500 });
      this.closeCreateDrawer();
    } catch (err: any) {
      this.invoiceError.set(err?.message || 'Fatura oluşturulamadı');
    } finally {
      this.submittingInvoice.set(false);
    }
  }

  async saveUyumsoftConfig(): Promise<void> {
    this.savingConfig.set(true);
    try {
      const v = this.configForm.getRawValue();
      await this.invoiceService.saveConfig(v as any);
      this.snackBar.open('✓ Uyumsoft entegrasyon ayarları başarıyla güncellendi.', 'Kapat', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Hata: ${err?.message || 'Kaydedilemedi'}`, 'Tamam', { duration: 3000 });
    } finally {
      this.savingConfig.set(false);
    }
  }

  formatDate(ts: any): string {
    if (!ts) return 'Bugün';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
