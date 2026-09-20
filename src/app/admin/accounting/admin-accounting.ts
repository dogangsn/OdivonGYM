import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatDate, formatMoney, fromDateInput, sortDesc, toDateInput, todayInput } from '../../shared/ui/ui-utils';
import { AdminAccountingService } from './admin-accounting.service';
import { AccountingEntry } from '../../core/models/accounting-entry.model';

type TypeFilter = 'all' | 'income' | 'expense';
type EntryType = AccountingEntry['type'];

const INCOME_CATEGORIES = ['Üyelik', 'Ürün Satışı', 'Ders / PT', 'Diğer Gelir'];
const EXPENSE_CATEGORIES = ['Kira', 'Maaş', 'Fatura', 'Bakım / Onarım', 'Ekipman', 'Pazarlama', 'Diğer Gider'];

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  wallet: 'E-Cüzdan',
};

@Component({
  selector: 'app-admin-accounting',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, MatIconModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="font-sans">
      <app-page-header
        title="Muhasebe"
        icon="account_balance"
        description="Gelir/gider kayıtları ve aylık mali özet."
      >
        <button actions type="button" class="odv-btn-primary" (click)="openForm()">
          <mat-icon class="icon-size-4.5">add</mat-icon>
          Yeni Kayıt
        </button>
      </app-page-header>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gelir</p>
          <p class="m-0 mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{{ money(totals().income) }}</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gider</p>
          <p class="m-0 mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{{ money(totals().expense) }}</p>
        </div>
        <div class="odv-card p-5">
          <p class="m-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net</p>
          <p
            class="m-0 mt-1 text-2xl font-black"
            [class]="totals().net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ money(totals().net) }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mb-4">
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
                  <th class="odv-th">Ödeme</th>
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
                    <td class="odv-td text-slate-600 dark:text-slate-300">{{ e.category }}</td>
                    <td class="odv-td text-slate-600 dark:text-slate-300">{{ e.paymentMethod ? paymentLabel[e.paymentMethod] : '—' }}</td>
                    <td
                      class="odv-td text-right font-bold whitespace-nowrap"
                      [class]="e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                    >
                      {{ e.type === 'income' ? '+' : '−' }}{{ money(e.amount) }}
                    </td>
                    <td class="odv-td text-right whitespace-nowrap">
                      <button type="button" class="odv-icon-btn" title="Düzenle" (click)="openForm(e)">
                        <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:pencil'"></mat-icon>
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

    <app-slide-over
      [open]="drawerOpen()"
      [title]="editing() ? 'Kaydı Düzenle' : 'Yeni Kayıt'"
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
              <option value="income">Gelir</option>
              <option value="expense">Gider</option>
            </select>
          </app-field>
          <app-field label="Tutar (₺)" [required]="true" [error]="err('amount', { required: 'Tutar gerekli.', min: 'Sıfırdan büyük olmalı.' })">
            <input type="number" min="0.01" step="0.01" formControlName="amount" class="odv-input" />
          </app-field>
          <app-field label="Kategori" [required]="true" [error]="err('category', { required: 'Kategori gerekli.' })">
            <input type="text" formControlName="category" class="odv-input" list="acc-categories" />
            <datalist id="acc-categories">
              @for (c of categoryOptions(); track c) {
                <option [value]="c"></option>
              }
            </datalist>
          </app-field>
          <app-field label="Tarih" [required]="true" [error]="err('entryDate', { required: 'Tarih gerekli.' })">
            <input type="date" formControlName="entryDate" class="odv-input" />
          </app-field>
        </div>
        <app-field label="Açıklama" [required]="true" [error]="err('description', { required: 'Açıklama gerekli.' })">
          <input type="text" formControlName="description" class="odv-input" />
        </app-field>
        <app-field label="Ödeme Yöntemi">
          <select formControlName="paymentMethod" class="odv-input">
            <option value="">Belirtilmedi</option>
            <option value="cash">Nakit</option>
            <option value="card">Kart</option>
            <option value="transfer">Havale</option>
            <option value="wallet">E-Cüzdan</option>
          </select>
        </app-field>
        <app-field label="Not">
          <textarea formControlName="notes" rows="2" class="odv-input resize-none"></textarea>
        </app-field>
      </div>
    </app-slide-over>
  `,
})
export class AdminAccounting {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AdminAccountingService);
  private readonly snackBar = inject(MatSnackBar);

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
    return this.form.controls.type.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
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
      this.snackBar.open(current ? 'Kayıt güncellendi.' : 'Kayıt eklendi.', 'Kapat', { duration: 3000 });
      this.close();
    } catch {
      this.errorMessage.set('Kaydedilemedi, tekrar dene.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(entry: AccountingEntry): Promise<void> {
    if (!confirm(`"${entry.description}" kaydını silmek istediğine emin misin?`)) return;
    try {
      await this.service.deleteEntry(entry.id);
      this.snackBar.open('Kayıt silindi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Kayıt silinemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }
}
