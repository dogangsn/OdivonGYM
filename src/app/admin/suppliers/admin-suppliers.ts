import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminSuppliersService } from './admin-suppliers.service';
import { Supplier, SupplierCategory } from '../../core/models/supplier.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { formatMoney } from '../../shared/ui/ui-utils';

const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  equipment: 'Ekipman & Cihaz',
  supplements: 'Supplement & Gıda',
  beverage: 'İçecek & Otomat',
  cleaning: 'Temizlik & Hijyen',
  tech_security: 'Bilişim & Güvenlik',
  other: 'Diğer Hizmetler',
};

const CATEGORY_BADGES: Record<SupplierCategory, string> = {
  equipment: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  supplements: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  beverage: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  cleaning: 'bg-amber-50 text-amber-700 border-amber-200',
  tech_security: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

@Component({
  selector: 'app-admin-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, PageHeader, SlideOver, Field],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-suppliers.html',
})
export class AdminSuppliers {
  private readonly suppliersService = inject(AdminSuppliersService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categoryBadges = CATEGORY_BADGES;
  protected readonly money = formatMoney;

  readonly suppliers = toSignal(this.suppliersService.watchSuppliers(), { initialValue: [] as Supplier[] });
  readonly searchTerm = signal('');
  readonly selectedCategory = signal<SupplierCategory | 'all'>('all');

  // SlideOver form
  readonly drawerOpen = signal(false);
  readonly editingSupplier = signal<Supplier | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    contactPerson: [''],
    category: ['equipment' as SupplierCategory, [Validators.required]],
    phone: ['', [Validators.required]],
    email: [''],
    taxOffice: [''],
    taxNumber: [''],
    balance: [0],
    iban: [''],
    address: [''],
    notes: [''],
  });

  readonly filteredSuppliers = computed(() => {
    let list = this.suppliers();
    const cat = this.selectedCategory();
    if (cat !== 'all') {
      list = list.filter((s) => s.category === cat);
    }
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.contactPerson?.toLowerCase().includes(term) ||
        s.phone.includes(term) ||
        s.taxNumber?.includes(term),
    );
  });

  readonly totalBalance = computed(() => {
    return this.suppliers().reduce((sum, s) => sum + (s.balance || 0), 0);
  });

  openNewDrawer(): void {
    this.editingSupplier.set(null);
    this.form.reset({
      name: '',
      contactPerson: '',
      category: 'equipment',
      phone: '',
      email: '',
      taxOffice: '',
      taxNumber: '',
      balance: 0,
      iban: '',
      address: '',
      notes: '',
    });
    this.drawerOpen.set(true);
  }

  openEditDrawer(s: Supplier): void {
    this.editingSupplier.set(s);
    this.form.reset({
      name: s.name,
      contactPerson: s.contactPerson || '',
      category: s.category,
      phone: s.phone,
      email: s.email || '',
      taxOffice: s.taxOffice || '',
      taxNumber: s.taxNumber || '',
      balance: s.balance || 0,
      iban: s.iban || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editingSupplier.set(null);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      const current = this.editingSupplier();
      if (current) {
        await this.suppliersService.updateSupplier(current.id, v);
        this.snackBar.open('Tedarikçi bilgileri güncellendi.', 'Kapat', { duration: 3000 });
      } else {
        await this.suppliersService.createSupplier(v);
        this.snackBar.open('Yeni tedarikçi başarıyla kaydedildi.', 'Kapat', { duration: 3000 });
      }
      this.closeDrawer();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Kaydedilemedi');
    } finally {
      this.submitting.set(false);
    }
  }

  async deleteSupplier(s: Supplier): Promise<void> {
    const ok = confirm(`"${s.name}" tedarikçisini silmek istediğinize emin misiniz?`);
    if (!ok) return;
    try {
      await this.suppliersService.deleteSupplier(s.id);
      this.snackBar.open('Tedarikçi silindi.', 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Silinemedi, tekrar deneyin.', 'Kapat', { duration: 3000 });
    }
  }

  async seedDefaults(): Promise<void> {
    await this.suppliersService.seedDefaultSuppliers();
    this.snackBar.open('Örnek tedarikçiler eklendi.', 'Kapat', { duration: 3000 });
  }
}
