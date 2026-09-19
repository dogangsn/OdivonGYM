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
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccountingEntry, CreateAccountingEntryInput } from '../../core/models/accounting-entry.model';

@Injectable({ providedIn: 'root' })
export class AdminAccountingService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchEntries(): Observable<AccountingEntry[]> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return new Observable<AccountingEntry[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'accounting_entries'),
      where('tenantId', '==', tenantId),
    );

    return collectionData(q, { idField: 'id' }) as Observable<AccountingEntry[]>;
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
    if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.entryDate) {
      updateData.entryDate = Timestamp.fromDate(input.entryDate);
    }

    await updateDoc(doc(this.firestore, 'accounting_entries', id), updateData);
  }

  async deleteEntry(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'accounting_entries', id));
  }
}
