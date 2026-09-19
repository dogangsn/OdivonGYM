import { Injectable, inject } from '@angular/core';
import {
  Firestore,
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
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WaterLog, CreateWaterLogInput } from '../../core/models/water-log.model';

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchLogs(): Observable<WaterLog[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<WaterLog[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'water_logs'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('date', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<WaterLog[]>;
  }

  async addLog(input: CreateWaterLogInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const date = new Date(input.date);
    date.setHours(0, 0, 0, 0);

    const docRef = await addDoc(collection(this.firestore, 'water_logs'), {
      userId,
      tenantId,
      date: Timestamp.fromDate(date),
      amount: input.amount,
      unit: input.unit,
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateLog(id: string, input: Partial<CreateWaterLogInput>): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.date) {
      const date = new Date(input.date);
      date.setHours(0, 0, 0, 0);
      updateData.date = Timestamp.fromDate(date);
    }

    await updateDoc(doc(this.firestore, 'water_logs', id), updateData);
  }

  async deleteLog(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'water_logs', id));
  }
}
