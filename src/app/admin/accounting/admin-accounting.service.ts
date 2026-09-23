import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountingEntry, CreateAccountingEntryInput } from '../../core/models/accounting-entry.model';

export interface AccountingCategory {
  id?: string;
  tenantId: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  createdAt?: any;
}

@Injectable({ providedIn: 'root' })
export class AdminAccountingService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchEntries(): Observable<AccountingEntry[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as AccountingEntry[]);
        }
        const q = query(
          collection(this.firestore, 'accounting_entries'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<AccountingEntry[]>;
      }),
    );
  }

  async addEntry(input: CreateAccountingEntryInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'accounting_entries'), {
      tenantId,
      type: input.type,
      amount: input.amount,
      category: input.category,
      description: input.description,
      referenceId: input.referenceId || '',
      referenceType: input.referenceType || null,
      paymentMethod: input.paymentMethod || null,
      notes: input.notes || '',
      entryDate: Timestamp.fromDate(input.entryDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateEntry(id: string, input: Partial<CreateAccountingEntryInput>): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.type !== undefined) updateData.type = input.type;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.referenceType !== undefined) updateData.referenceType = input.referenceType;
    if ('paymentMethod' in input) updateData.paymentMethod = input.paymentMethod ?? null;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.entryDate) {
      updateData.entryDate = Timestamp.fromDate(input.entryDate);
    }

    await updateDoc(doc(this.firestore, 'accounting_entries', id), updateData);
  }

  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'accounting_entries', id));
  }

  watchCategories(): Observable<AccountingCategory[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as AccountingCategory[]);
        }
        const q = query(
          collection(this.firestore, 'accounting_categories'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<AccountingCategory[]>;
      }),
    );
  }

  async addCategory(name: string, type: 'income' | 'expense' | 'both'): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const docRef = await addDoc(collection(this.firestore, 'accounting_categories'), {
      tenantId,
      name: name.trim(),
      type,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'accounting_categories', id));
  }

  async seedDefaultCategoriesIfEmpty(): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) return;

    const q = query(
      collection(this.firestore, 'accounting_categories'),
      where('tenantId', '==', tenantId),
    );
    const snap = await getDocs(q);
    if (!snap.empty) return;

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
}
