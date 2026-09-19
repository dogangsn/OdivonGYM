import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  doc,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WalletTransaction, CreateWalletTransactionInput } from '../../core/models/wallet-transaction.model';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchTransactions(): Observable<WalletTransaction[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<WalletTransaction[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'wallet_transactions'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<WalletTransaction[]>;
  }

  async addTransaction(input: CreateWalletTransactionInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'wallet_transactions'), {
      userId,
      tenantId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      referenceId: input.referenceId || null,
      referenceType: input.referenceType || null,
      status: 'completed',
      paymentMethod: input.paymentMethod || 'cash',
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateTransaction(id: string, status: string): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Tenant bilgisi bulunamadı');

    await updateDoc(doc(this.firestore, 'wallet_transactions', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'wallet_transactions', id));
  }
}
