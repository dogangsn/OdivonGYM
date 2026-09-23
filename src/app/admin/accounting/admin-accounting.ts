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

type TypeFilter = 'all' | 'income' | 'expense';
type EntryType = AccountingEntry['type'];

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  wallet: 'E-Cüzdan',
};

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans space-y-6">
      <app-page-header
        title="Muhasebe & Mali Kasa"
        icon="account_balance"
        description="Gelir/gider kayıtları, kategori bazlı bütçe yönetimi ve aylık mali özet."
      >
        <div actions class="flex items-center gap-2">
          <button type="button" class="odv-btn-soft" (click)="openCategoryModal()">
            <mat-icon class="icon-size-4">category</mat-icon>
            <span>Kategorileri Yönet</span>
          </button>
          <button type="button" class="odv-btn-primary" (click)="openForm()">
            <mat-icon class="icon-size-4.5">add</mat-icon>
            <span>Yeni Kayıt Ekle</span>
          </button>
        </div>
      </app-page-header>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Toplam Gelir</p>
          <p class="m-0 mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{{ money(totals().income) }}</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Toplam Gider</p>
          <p class="m-0 mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{{ money(totals().expense) }}</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Kasa Durumu</p>
          <p
            class="m-0 mt-1 text-2xl font-black"
            [class]="totals().net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ money(totals().net) }}
          </p>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex gap-2">
          @for (f of filters; track f.id) {
            <button
              type="button"
              (click)="typeFilter.set(f.id)"
              class="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              [class]="
                typeFilter() === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              "
            >
              {{ f.label }}
            </button>
          }
        </div>
        <input
          type="month"
          class="odv-input !w-auto"
          [ngModel]="monthFilter()"
          (ngModelChange)="monthFilter.set($event)"
          aria-label="Ay filtresi"
        />
        @if (monthFilter()) {
          <button type="button" class="odv-btn-soft" (click)="monthFilter.set('')">Tüm zamanlar</button>
        }
      </div>

      <!-- Entries Table -->
      <div class="odv-card overflow-hidden">
        @if (entries() === null) {
          <p class="py-16 text-center text-sm text-slate-500 dark:text-slate-400 m-0">Yükleniyor…</p>
        } @else if (visible().length === 0) {
          <div class="py-16 text-center">
            <p class="text-sm text-slate-500 dark:text-slate-400 m-0">Bu görünümde kayıt yok.</p>
            <button type="button" class="odv-btn-soft mt-4" (click)="openForm()">+ Kayıt Ekle</button>
          </div>
        } @else {
          <div class="overflow-x-auto custom-scroll">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <th class="odv-th">Tarih</th>
                  <th class="odv-th">Açıklama</th>
                  <th class="odv-th">Kategori</th>
                  <th class="odv-th">Ödeme Yöntemi</th>
                  <th class="odv-th text-right">Tutar</th>
                  <th class="odv-th text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                @for (e of visible(); track e.id) {
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="odv-td text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ date(e.entryDate) }}</td>
                    <td class="odv-td">
                      <p class="font-semibold text-slate-900 dark:text-white m-0">{{ e.description }}</p>
                      @if (e.notes) {
                        <p class="text-[11px] text-slate-400 m-0">{{ e.notes }}</p>
                      }
                    </td>
                    <td class="odv-td">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {{ e.category }}
                      </span>
                    </td>
                    <td class="odv-td text-slate-600 dark:text-slate-300">{{ e.paymentMethod ? paymentLabel[e.paymentMethod] : '—' }}</td>
                    <td
                      class="odv-td text-right font-bold whitespace-nowrap"
                      [class]="e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                    >
                      {{ e.type === 'income' ? '+' : '−' }}{{ money(e.amount) }}
                    </td>
                    <td class="odv-td text-right whitespace-nowrap">
                      <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(e)">
                        <mat-icon class="icon-size-4">edit</mat-icon>
                      </button>
                      <button type="button" class="odv-icon-btn odv-icon-btn-danger ml-1" title="Sil" (click)="remove(e)">
                        <mat-icon class="icon-size-4">delete</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- 1. Kayıt Ekle / Düzenle Slide-Over -->
    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Kaydı Düzenle' : 'Yeni Muhasebe Kaydı'"
      [submitLabel]="editing() ? 'Değişiklikleri Kaydet' : 'Kaydı Ekle'"
      [submitting]="submitting()"
      [errorMessage]="errorMessage()"
      (closed)="close()"
      (submitted)="submit()"
    >
      <div [formGroup]="form" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Tür" [required]="true">
            <select formControlName="type" class="odv-input">
              <option value="income">Gelir (+)</option>
              <option value="expense">Gider (−)</option>
            </select>
          </app-field>
          <app-field label="Tutar (₺)" [required]="true" [error]="err('amount', { required: 'Tutar gerekli.', min: 'Sıfırdan büyük olmalı.' })">
            <input type="number" min="0.01" step="0.01" formControlName="amount" class="odv-input font-bold" />
          </app-field>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="odv-label required m-0">Kategori</label>
            <button
              type="button"
              (click)="openCategoryModal()"
              class="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer"
            >
              <mat-icon class="icon-size-3.5">add_circle</mat-icon>
              <span>+ Yeni Kategori Tanımla</span>
            </button>
          </div>
          <select formControlName="category" class="odv-input">
            <option value="">-- Kategori Seçiniz --</option>
            @for (c of categoryOptions(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          @if (form.controls.category.touched && form.controls.category.invalid) {
            <p class="text-xs text-rose-500 mt-1 m-0">Kategori seçimi zorunludur.</p>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <app-field label="Tarih" [required]="true" [error]="err('entryDate', { required: 'Tarih gerekli.' })">
            <input type="date" formControlName="entryDate" class="odv-input" />
          </app-field>
          <app-field label="Ödeme Yöntemi">
            <select formControlName="paymentMethod" class="odv-input">
              <option value="">Belirtilmedi</option>
              <option value="cash">Nakit</option>
              <option value="card">Banka / Kredi Kartı</option>
              <option value="transfer">Havale / EFT</option>
              <option value="wallet">Üye Cüzdanı</option>
            </select>
          </app-field>
        </div>

        <app-field label="Açıklama" [required]="true" [error]="err('description', { required: 'Açıklama gerekli.' })">
          <input type="text" formControlName="description" placeholder="Örn: Yıllık Gold Üyelik Bedeli veya Salon Kirası" class="odv-input" />
        </app-field>

        <app-field label="Özel Not">
          <textarea formControlName="notes" rows="2" placeholder="Fatura no, dekont referansı vb." class="odv-input resize-none text-xs"></textarea>
        </app-field>
      </div>
    </app-slide-over>

    <!-- 2. Kategori Tanımlama ve Yönetim Slide-Over -->
    <app-slide-over
      [open]="categoryModalOpen()"
      title="Muhasebe Kategorileri"
      submitLabel="Kategoriyi Ekle"
      [submitting]="savingCategory()"
      (closed)="closeCategoryModal()"
      (submitted)="saveNewCategory()"
    >
      <div class="space-y-5">
        <!-- New Category Box -->
        <div class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200 m-0">Yeni Kategori Ekle</h4>
          <div>
            <label class="odv-label required">Kategori Adı</label>
            <input
              type="text"
              [(ngModel)]="newCategoryName"
              placeholder="Örn: Supplement Satışı, Danışmanlık"
              class="odv-input"
            />
          </div>
          <div>
            <label class="odv-label required">Kategori Türü</label>
            <select [(ngModel)]="newCategoryType" class="odv-input">
              <option value="income">Gelir Kategorisi</option>
              <option value="expense">Gider Kategorisi</option>
              <option value="both">Her İkisi (Gelir & Gider)</option>
            </select>
          </div>
        </div>

        <!-- Existing Categories List -->
        <div>
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Tanımlı Kategoriler ({{ categories().length }})</h4>
          <div class="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-80 overflow-y-auto custom-scroll">
            @for (cat of categories(); track cat.id || cat.name) {
              <div class="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div class="flex items-center gap-2">
                  <span
                    class="w-2 h-2 rounded-full"
                    [class.bg-emerald-500]="cat.type === 'income'"
                    [class.bg-rose-500]="cat.type === 'expense'"
                    [class.bg-indigo-500]="cat.type === 'both'"
                  ></span>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{ cat.name }}</span>
                  <span class="text-[10px] text-slate-400">
                    ({{ cat.type === 'income' ? 'Gelir' : cat.type === 'expense' ? 'Gider' : 'Ortak' }})
                  </span>
                </div>
                @if (cat.id) {
                  <button
                    type="button"
                    (click)="deleteCategory(cat)"
                    class="w-6 h-6 rounded text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
                    title="Kategoriyi Sil"
                  >
                    <mat-icon class="icon-size-3.5">delete</mat-icon>
                  </button>
                }
              </div>
            } @empty {
              <div class="p-6 text-center text-xs text-slate-400">
                Henüz kayıtlı kategori bulunmuyor.
              </div>
            }
          </div>
        </div>
      </div>
    </app-slide-over>
  `,
})
export class AdminAccounting implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminAccountingService);
  private readonly alertService = inject(AlertService);

  protected readonly filters: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'income', label: 'Gelir' },
    { id: 'expense', label: 'Gider' },
  ];
  protected readonly paymentLabel = PAYMENT_LABEL;
  protected readonly money = formatMoney;
  protected readonly date = formatDate;

  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly monthFilter = signal('');

  private readonly data = toSignal(this.service.watchEntries(), { initialValue: null });
  protected readonly categories = toSignal(this.service.watchCategories(), { initialValue: [] as AccountingCategory[] });

  // Category Modal state
  protected readonly categoryModalOpen = signal(false);
  protected readonly savingCategory = signal(false);
  protected newCategoryName = '';
  protected newCategoryType: 'income' | 'expense' | 'both' = 'income';

  ngOnInit(): void {
    // Seed standard categories dynamically if tenant has none
    this.service.seedDefaultCategoriesIfEmpty().catch(() => {});
  }

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

  protected categoryOptions(): string[] {
    const selectedType = this.form.controls.type.value;
    const all = this.categories();
    if (all.length === 0) {
      return selectedType === 'income'
        ? ['Üyelik & Abonelik Satışı', 'Market & Ürün Satışı', 'Özel Ders (PT)', 'Diğer Gelir']
        : ['Salon Kirası', 'Personel Maaşları', 'Fatura & Enerji', 'Ekipman & Bakım', 'Diğer Gider'];
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
    } catch {
      this.alertService.toastError('Kayıt silinemedi, tekrar dene.');
    }
  }

  // Category Modal Handlers
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
      // Auto-select this newly created category in the active form
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
}
