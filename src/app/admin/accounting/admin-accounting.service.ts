import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { AccountingApi } from '../../core/api/accounting.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { AccountingEntry, CreateAccountingEntryInput } from '../../core/models/accounting-entry.model';
import { SubmitDailyCloseDto } from '../../core/models/daily-close.model';

export interface AccountingCategory {
  id?: string;
  tenantId: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  createdAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class AdminAccountingService {
  private readonly api = inject(AccountingApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchEntries(): Observable<AccountingEntry[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list());
  }

  async addEntry(input: CreateAccountingEntryInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.create({
        ...input,
        entryDate: input.entryDate.toISOString(),
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateEntry(id: string, input: Partial<CreateAccountingEntryInput>): Promise<void> {
    await firstValueFrom(
      this.api.update(id, {
        ...input,
        entryDate: input.entryDate ? input.entryDate.toISOString() : undefined,
      }),
    );
    this.reload$.next();
  }

  async deleteEntry(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }

  watchCategories(): Observable<AccountingCategory[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listCategories() as Observable<AccountingCategory[]>);
  }

  async addCategory(name: string, type: 'income' | 'expense' | 'both'): Promise<string> {
    const created = await firstValueFrom(this.api.createCategory({ name: name.trim(), type }));
    this.reload$.next();
    return created.id ?? '';
  }

  async deleteCategory(id: string): Promise<void> {
    await firstValueFrom(this.api.removeCategory(id));
    this.reload$.next();
  }

  async seedDefaultCategoriesIfEmpty(): Promise<void> {
    const existing = await firstValueFrom(this.api.listCategories());
    if (existing.length) return;
    const defaults: { name: string; type: 'income' | 'expense' | 'both' }[] = [
      { name: 'Üyelik & Abonelik Satışı', type: 'income' },
      { name: 'Market & Ürün Satışı', type: 'income' },
      { name: 'Özel Ders (PT)', type: 'income' },
      { name: 'Kart & Depozito Geliri', type: 'income' },
      { name: 'Diğer Gelir', type: 'income' },
      { name: 'Salon Kirası', type: 'expense' },
      { name: 'Personel Maaşları', type: 'expense' },
      { name: 'Elektrik & Su & Isınma', type: 'expense' },
      { name: 'Ekipman & Bakım Onarım', type: 'expense' },
      { name: 'Temizlik & Hijyen Sarf', type: 'expense' },
      { name: 'Pazarlama & Reklam', type: 'expense' },
      { name: 'Vergi & Muhasebe', type: 'expense' },
      { name: 'Diğer Gider', type: 'expense' },
    ];
    for (const cat of defaults) {
      await this.addCategory(cat.name, cat.type);
    }
  }

  // Daily Close (Z Report)
  async getDailyClosePreview(date?: string, branchId?: string) {
    return firstValueFrom(this.api.getDailyClosePreview(date, branchId));
  }

  async submitDailyClose(input: SubmitDailyCloseDto) {
    const res = await firstValueFrom(this.api.submitDailyClose(input));
    this.reload$.next();
    return res;
  }

  async listDailyClosings(branchId?: string, limit = 50) {
    return firstValueFrom(this.api.listDailyClosings(branchId, limit));
  }

  async getDailyCloseById(id: string) {
    return firstValueFrom(this.api.getDailyCloseById(id));
  }

  async verifyDailyClose(id: string, notes?: string) {
    const res = await firstValueFrom(this.api.verifyDailyClose(id, notes));
    this.reload$.next();
    return res;
  }

  // Expense Analytics
  async getExpenseAnalytics(params?: { startDate?: string; endDate?: string; branchId?: string }) {
    return firstValueFrom(this.api.getExpenseAnalytics(params));
  }
}

