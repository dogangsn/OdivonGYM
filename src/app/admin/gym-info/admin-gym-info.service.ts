import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, setDoc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../../core/auth/auth.service';
import { CreateGymInfoInput, GymInfo } from '../../core/models/gym-info.model';

/** Salon başına tek doküman: `gym_info/{tenantId}`. */
@Injectable({ providedIn: 'root' })
export class AdminGymInfoService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private tenantId(): string {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');
    return tenantId;
  }

  async load(): Promise<GymInfo | null> {
    const tenantId = this.tenantId();
    const snap = await getDoc(doc(this.firestore, 'gym_info', tenantId));
    return snap.exists() ? ({ id: tenantId, ...snap.data() } as GymInfo) : null;
  }

  /** Doküman yoksa oluşturur (ilk kayıt), varsa günceller. */
  async save(input: CreateGymInfoInput, exists: boolean): Promise<void> {
    const tenantId = this.tenantId();
    const ref = doc(this.firestore, 'gym_info', tenantId);
    const data = {
      businessName: input.businessName,
      businessType: input.businessType,
      taxId: input.taxId ?? '',
      businessEmail: input.businessEmail,
      businessPhone: input.businessPhone,
      website: input.website ?? '',
      trialDays: input.trialDays,
      maxFreezeDays: input.maxFreezeDays ?? 0,
      cancellationPolicy: input.cancellationPolicy ?? '',
      termsAndConditions: input.termsAndConditions ?? '',
      features: input.features,
      updatedAt: serverTimestamp(),
    };

    if (exists) {
      await updateDoc(ref, data);
    } else {
      await setDoc(ref, { ...data, tenantId, createdAt: serverTimestamp() });
    }
  }
}
