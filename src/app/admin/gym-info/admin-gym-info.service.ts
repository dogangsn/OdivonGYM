import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { signal, Signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { GymInfo, CreateGymInfoInput, UpdateGymInfoInput } from '../../core/models/gym-info.model';

@Injectable({ providedIn: 'root' })
export class AdminGymInfoService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private gymInfoSignal: Signal<GymInfo | null> | null = null;

  async loadGymInfo(): Promise<GymInfo | null> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return null;
    }

    const docSnap = await getDoc(doc(this.firestore, 'gym_info', tenantId));

    if (docSnap.exists()) {
      return { id: tenantId, ...docSnap.data() } as GymInfo;
    }

    return null;
  }

  async createGymInfo(input: CreateGymInfoInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    await setDoc(doc(this.firestore, 'gym_info', tenantId), {
      tenantId,
      businessName: input.businessName,
      businessType: input.businessType,
      taxId: input.taxId || '',
      businessEmail: input.businessEmail,
      businessPhone: input.businessPhone,
      website: input.website || '',
      logo: input.logo || '',
      trialDays: input.trialDays,
      defaultPackageId: input.defaultPackageId || '',
      maxFreezeDays: input.maxFreezeDays || 0,
      cancellationPolicy: input.cancellationPolicy || '',
      termsAndConditions: input.termsAndConditions || '',
      features: input.features,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return tenantId;
  }

  async updateGymInfo(input: UpdateGymInfoInput): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı');
    }

    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.businessName !== undefined) updateData.businessName = input.businessName;
    if (input.taxId !== undefined) updateData.taxId = input.taxId;
    if (input.businessEmail !== undefined) updateData.businessEmail = input.businessEmail;
    if (input.businessPhone !== undefined) updateData.businessPhone = input.businessPhone;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.logo !== undefined) updateData.logo = input.logo;
    if (input.trialDays !== undefined) updateData.trialDays = input.trialDays;
    if (input.defaultPackageId !== undefined) updateData.defaultPackageId = input.defaultPackageId;
    if (input.maxFreezeDays !== undefined) updateData.maxFreezeDays = input.maxFreezeDays;
    if (input.cancellationPolicy !== undefined) updateData.cancellationPolicy = input.cancellationPolicy;
    if (input.termsAndConditions !== undefined) updateData.termsAndConditions = input.termsAndConditions;
    if (input.features !== undefined) updateData.features = input.features;

    await setDoc(doc(this.firestore, 'gym_info', tenantId), updateData, { merge: true });
  }
}
