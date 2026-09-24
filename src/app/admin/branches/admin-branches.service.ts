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
import { GymBranch, CreateGymBranchInput, UpdateGymBranchInput } from '../../core/models/gym-branch.model';

@Injectable({ providedIn: 'root' })
export class AdminBranchesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchBranches(): Observable<GymBranch[]> {
    return toObservable(this.auth.profile).pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as GymBranch[]);
        }
        const q = query(
          collection(this.firestore, 'gym_branches'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<GymBranch[]>;
      }),
    );
  }

  async createBranch(input: CreateGymBranchInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'gym_branches'), {
      tenantId,
      name: input.name,
      logoUrl: input.logoUrl || '',
      address: input.address,
      city: input.city,
      postalCode: input.postalCode || '',
      phone: input.phone,
      email: input.email,
      website: input.website || '',
      capacity: input.capacity,
      currentOccupancy: 0,
      openingHours: input.openingHours,
      openDays: input.openDays || [1, 2, 3, 4, 5, 6, 0],
      features: input.features,
      status: 'active',
      managerName: input.managerName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateBranch(id: string, input: UpdateGymBranchInput): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.status !== undefined) updateData.status = input.status;
    if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.capacity !== undefined) updateData.capacity = input.capacity;
    if (input.openingHours !== undefined) updateData.openingHours = input.openingHours;
    if (input.openDays !== undefined) updateData.openDays = input.openDays;
    if (input.features !== undefined) updateData.features = input.features;
    if (input.managerName !== undefined) updateData.managerName = input.managerName;

    await updateDoc(doc(this.firestore, 'gym_branches', id), updateData);
  }

  async deleteBranch(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'gym_branches', id));
  }
}
