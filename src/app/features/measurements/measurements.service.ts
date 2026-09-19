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
import { BodyMeasurement, CreateBodyMeasurementInput } from '../../core/models/body-measurement.model';

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchMeasurements(): Observable<BodyMeasurement[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<BodyMeasurement[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'body_measurements'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('date', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<BodyMeasurement[]>;
  }

  async addMeasurement(input: CreateBodyMeasurementInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const date = new Date(input.date);
    date.setHours(0, 0, 0, 0);

    const docRef = await addDoc(collection(this.firestore, 'body_measurements'), {
      userId,
      tenantId,
      date: Timestamp.fromDate(date),
      weight: input.weight || null,
      chest: input.chest || null,
      waist: input.waist || null,
      hips: input.hips || null,
      bicep: input.bicep || null,
      thigh: input.thigh || null,
      calf: input.calf || null,
      bodyFatPercentage: input.bodyFatPercentage || null,
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateMeasurement(id: string, input: Partial<CreateBodyMeasurementInput>): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.weight !== undefined) updateData.weight = input.weight;
    if (input.chest !== undefined) updateData.chest = input.chest;
    if (input.waist !== undefined) updateData.waist = input.waist;
    if (input.hips !== undefined) updateData.hips = input.hips;
    if (input.bicep !== undefined) updateData.bicep = input.bicep;
    if (input.thigh !== undefined) updateData.thigh = input.thigh;
    if (input.calf !== undefined) updateData.calf = input.calf;
    if (input.bodyFatPercentage !== undefined) updateData.bodyFatPercentage = input.bodyFatPercentage;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.date) {
      const date = new Date(input.date);
      date.setHours(0, 0, 0, 0);
      updateData.date = Timestamp.fromDate(date);
    }

    await updateDoc(doc(this.firestore, 'body_measurements', id), updateData);
  }

  async deleteMeasurement(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'body_measurements', id));
  }
}
