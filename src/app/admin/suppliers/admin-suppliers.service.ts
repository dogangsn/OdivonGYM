import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { SuppliersApi } from '../../core/api/suppliers.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateSupplierInput,
  DEFAULT_SUPPLIER_CATEGORIES,
  Supplier,
  SupplierCategoryItem,
  UpdateSupplierInput,
} from '../../core/models/supplier.model';

@Injectable({ providedIn: 'root' })
export class AdminSuppliersService {
  private readonly api = inject(SuppliersApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchCategories(): Observable<SupplierCategoryItem[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listCategories());
  }

  async createCategory(input: { name: string; colorTag?: string; description?: string }): Promise<string> {
    const created = await firstValueFrom(this.api.createCategory(input));
    this.reload$.next();
    return created.id ?? '';
  }

  async updateCategory(id: string, input: Partial<SupplierCategoryItem>): Promise<void> {
    await firstValueFrom(this.api.updateCategory(id, input));
    this.reload$.next();
  }

  async deleteCategory(id: string): Promise<void> {
    await firstValueFrom(this.api.removeCategory(id));
    this.reload$.next();
  }

  async seedDefaultCategoriesIfEmpty(_tenantIdParam?: string): Promise<void> {
    const existing = await firstValueFrom(this.api.listCategories());
    if (existing.length) return;
    for (const cat of DEFAULT_SUPPLIER_CATEGORIES) {
      await firstValueFrom(this.api.createCategory(cat));
    }
    this.reload$.next();
  }

  watchSuppliers(): Observable<Supplier[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list());
  }

  async createSupplier(input: CreateSupplierInput): Promise<string> {
    const created = await firstValueFrom(this.api.create(input));
    this.reload$.next();
    return created.id;
  }

  async updateSupplier(id: string, input: UpdateSupplierInput): Promise<void> {
    await firstValueFrom(this.api.update(id, input));
    this.reload$.next();
  }

  async deleteSupplier(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }

  async seedDefaultSuppliers(): Promise<number> {
    const existing = await firstValueFrom(this.api.list());
    const names = new Set(existing.map((s) => s.name.toLowerCase()));
    const presets: CreateSupplierInput[] = [
      {
        name: 'TechnoGym Türkiye',
        category: 'equipment',
        phone: '0212 000 00 00',
        contactPerson: 'Satış',
        status: 'active',
      },
    ];
    let added = 0;
    for (const preset of presets) {
      if (names.has(preset.name.toLowerCase())) continue;
      await this.createSupplier(preset);
      added++;
    }
    return added;
  }
}
