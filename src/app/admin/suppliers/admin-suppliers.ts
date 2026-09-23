import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminSuppliersService } from './admin-suppliers.service';
import { Supplier, SupplierCategoryItem } from '../../core/models/supplier.model';
import { SlideOver } from '../../shared/ui/slide-over';
import { Field } from '../../shared/ui/field';
import { firstError, formatMoney } from '../../shared/ui/ui-utils';

const CATEGORY_LABELS: Record<string, string> = {
  equipment: 'Ekipman & Cihaz',
  supplements: 'Supplement & Gıda',
  beverage: 'İçecek & Otomat',
  cleaning: 'Temizlik & Hijyen',
  tech_security: 'Bilişim & Güvenlik',
  other: 'Diğer Hizmetler',
};

const CATEGORY_BADGES: Record<string, string> = {
  equipment: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  supplements: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  beverage: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
  cleaning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  tech_security: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  other: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
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
  private readonly alertService = inject(AlertService);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categoryBadges = CATEGORY_BADGES;
  protected readonly money = formatMoney;

  readonly suppliers = toSignal(this.suppliersService.watchSuppliers(), { initialValue: [] as Supplier[] });
  readonly categories = toSignal(this.suppliersService.watchCategories(), { initialValue: [] as SupplierCategoryItem[] });

  readonly searchTerm = signal('');
  readonly selectedCategory = signal<string>('all');

  // SlideOver form
  readonly drawerOpen = signal(false);
  readonly editingSupplier = signal<Supplier | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  // Category Management SlideOver
  readonly categoryModalOpen = signal(false);
  readonly savingCategory = signal(false);
  newCategoryName = '';
  newCategoryColor = 'indigo';
  newCategoryDescription = '';

  readonly colorOptions = [
    { id: 'indigo', label: 'İndigo / Mavi' },
    { id: 'emerald', label: 'Zümrüt / Yeşil' },
    { id: 'cyan', label: 'Turkuaz / Cyan' },
    { id: 'amber', label: 'Kehribar / Turuncu' },
    { id: 'purple', label: 'Mor / Lila' },
    { id: 'rose', label: 'Gül / Kırmızı' },
    { id: 'slate', label: 'Gri / Nötr' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    contactPerson: [''],
    category: ['equipment', [Validators.required]],
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

  getCategoryLabel(key: string): string {
    const found = this.categories().find((c) => c.key === key || c.name === key);
    if (found) return found.name;
    return CATEGORY_LABELS[key] || key;
  }

  getCategoryBadge(key: string): string {
    const found = this.categories().find((c) => c.key === key || c.name === key);
    if (found && found.badgeClass) return found.badgeClass;
    if (found && found.colorTag) {
      const color = found.colorTag;
      return `bg-${color}-50 text-${color}-700 border-${color}-200 dark:bg-${color}-950/60 dark:text-${color}-300 dark:border-${color}-800`;
    }
    return CATEGORY_BADGES[key] || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
  }

  getCategorySupplierCount(key: string): number {
    return this.suppliers().filter((s) => s.category === key).length;
  }

  openCategoryModal(): void {
    this.newCategoryName = '';
    this.newCategoryColor = 'indigo';
    this.newCategoryDescription = '';
    this.categoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
  }

  async saveNewCategory(): Promise<void> {
    const name = this.newCategoryName.trim();
    if (!name) {
      this.alertService.toastError('Lütfen kategori adını girin.');
      return;
    }

    this.savingCategory.set(true);
    try {
      await this.suppliersService.createCategory({
        name,
        colorTag: this.newCategoryColor,
        description: this.newCategoryDescription.trim(),
      });
      this.alertService.toastSuccess(`"${name}" kategorisi başarıyla oluşturuldu.`);
      this.newCategoryName = '';
      this.newCategoryDescription = '';
    } catch (err: any) {
      this.alertService.toastError(err?.message || 'Kategori eklenemedi.');
    } finally {
      this.savingCategory.set(false);
    }
  }

  async deleteCategory(cat: SupplierCategoryItem): Promise<void> {
    const count = this.getCategorySupplierCount(cat.key);
    if (count > 0) {
      const confirmed = await this.alertService.actionConfirm(
        'Kategoriyi Sil',
        `Bu kategoriye bağlı <strong>${count}</strong> adet tedarikçi bulunuyor. Yine de silmek istiyor musunuz?`,
        'Evet, Sil',
        'warning',
        true,
      );
      if (!confirmed) return;
    } else {
      const ok = await this.alertService.deleteConfirm(cat.name);
      if (!ok) return;
    }

    try {
      if (cat.id) {
        await this.suppliersService.deleteCategory(cat.id);
        this.alertService.toastSuccess('Kategori silindi.');
      }
    } catch {
      this.alertService.toastError('Kategori silinemedi.');
    }
  }

  openNewDrawer(): void {
    this.editingSupplier.set(null);
    const defaultCat = this.categories()[0]?.key || 'equipment';
    this.form.reset({
      name: '',
      contactPerson: '',
      category: defaultCat,
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

  fieldErr(name: keyof typeof this.form.controls, messages: Record<string, string>): string {
    return firstError(this.form.controls[name], messages);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Lütfen zorunlu alanları (Firma Adı ve Telefon) doldurunuz.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const v = this.form.getRawValue();
      const current = this.editingSupplier();
      if (current) {
        await this.suppliersService.updateSupplier(current.id, v);
        this.alertService.toastSuccess('Tedarikçi bilgileri güncellendi.');
      } else {
        await this.suppliersService.createSupplier(v);
        this.alertService.toastSuccess('Yeni tedarikçi başarıyla kaydedildi.');
      }
      this.closeDrawer();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Kaydedilemedi');
    } finally {
      this.submitting.set(false);
    }
  }

  async deleteSupplier(s: Supplier): Promise<void> {
    const ok = await this.alertService.deleteConfirm(s.name);
    if (!ok) return;
    try {
      await this.suppliersService.deleteSupplier(s.id);
      this.alertService.toastSuccess('Tedarikçi silindi.');
    } catch {
      this.alertService.toastError('Silinemedi, tekrar deneyin.');
    }
  }

  async seedDefaults(): Promise<void> {
    try {
      const count = await this.suppliersService.seedDefaultSuppliers();
      if (count === 0) {
        this.alertService.toastInfo('Örnek tedarikçiler zaten kayıtlı.');
      } else {
        this.alertService.toastSuccess(`${count} adet örnek tedarikçi başarıyla eklendi.`);
      }
    } catch (e: any) {
      this.alertService.toastError(e.message || 'Örnek tedarikçiler yüklenemedi.');
    }
  }
}
