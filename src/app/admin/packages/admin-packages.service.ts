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
} from '@angular/fire/firestore';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { GymPackage, CreateGymPackageInput, UpdateGymPackageInput } from '../../core/models/gym-package.model';

@Injectable({ providedIn: 'root' })
export class AdminPackagesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchPackages(): Observable<GymPackage[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as GymPackage[]);
        }
        const q = query(
          collection(this.firestore, 'gym_packages'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<GymPackage[]>;
      }),
    );
  }

  async createPackage(input: CreateGymPackageInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'gym_packages'), {
      tenantId,
      name: input.name,
      category: input.category || 'Genel Fitness',
      durationDays: input.durationDays,
      durationType: input.durationType || 'day',
      durationValue: input.durationValue ?? input.durationDays,
      price: input.price,
      description: input.description || '',
      features: input.features,
      maxFreeze: input.maxFreeze || 0,
      trialEligible: input.trialEligible,
      allowedDays: input.allowedDays ?? [1, 2, 3, 4, 5, 6, 7],
      checkInStartTime: input.checkInStartTime || '06:00',
      checkInEndTime: input.checkInEndTime || '23:00',
      sessionCount: input.sessionCount ?? null,
      isUnlimitedSessions: !!input.isUnlimitedSessions,
      barcode: input.barcode?.trim() || '',
      isHidden: !!input.isHidden,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updatePackage(id: string, input: UpdateGymPackageInput): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.durationDays !== undefined) updateData.durationDays = input.durationDays;
    if (input.durationType !== undefined) updateData.durationType = input.durationType;
    if (input.durationValue !== undefined) updateData.durationValue = input.durationValue;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.features !== undefined) updateData.features = input.features;
    if (input.maxFreeze !== undefined) updateData.maxFreeze = input.maxFreeze;
    if (input.trialEligible !== undefined) updateData.trialEligible = input.trialEligible;
    if (input.allowedDays !== undefined) updateData.allowedDays = input.allowedDays;
    if (input.checkInStartTime !== undefined) updateData.checkInStartTime = input.checkInStartTime;
    if (input.checkInEndTime !== undefined) updateData.checkInEndTime = input.checkInEndTime;
    if (input.sessionCount !== undefined) updateData.sessionCount = input.sessionCount;
    if (input.isUnlimitedSessions !== undefined) updateData.isUnlimitedSessions = input.isUnlimitedSessions;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;
    if (input.isHidden !== undefined) updateData.isHidden = input.isHidden;

    await updateDoc(doc(this.firestore, 'gym_packages', id), updateData);
  }

  async deletePackage(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_packages', id));
  }
}
