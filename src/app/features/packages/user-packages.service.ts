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
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { UserPackagePurchase, CreateUserPackagePurchaseInput, GymPackage } from '../../core/models/gym-package.model';

@Injectable({ providedIn: 'root' })
export class UserPackagesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchUserPackages(): Observable<UserPackagePurchase[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<UserPackagePurchase[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'user_packages'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('purchaseDate', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<UserPackagePurchase[]>;
  }

  watchAvailablePackages(): Observable<GymPackage[]> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return new Observable<GymPackage[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'gym_packages'),
      where('tenantId', '==', tenantId),
      where('status', '==', 'active'),
      orderBy('durationDays'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<GymPackage[]>;
  }

  async purchasePackage(input: CreateUserPackagePurchaseInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'user_packages'), {
      userId,
      tenantId,
      packageId: input.packageId,
      packageName: input.packageName,
      purchaseDate: serverTimestamp(),
      startDate: Timestamp.fromDate(input.startDate),
      endDate: Timestamp.fromDate(input.endDate),
      autoRenew: input.autoRenew,
      renewalDate: null,
      paymentMethod: input.paymentMethod,
      price: input.price,
      status: 'active',
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }
}
