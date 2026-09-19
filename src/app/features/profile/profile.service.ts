import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc, serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { AuthService } from '../../core/auth/auth.service';
import { UserProfile, Gender } from '../../core/models/user-profile.model';

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string;
  gender?: Gender;
  birthDate?: Date | null;
  country?: string;
  language?: string;
  photoURL?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  async updateProfile(input: UpdateProfileInput): Promise<void> {
    const uid = this.auth.currentUser()?.uid;
    if (!uid) throw new Error('Kullanıcı oturumu bulunamadı');

    const updateData: Partial<UserProfile> = {
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.photoURL !== undefined) updateData.photoURL = input.photoURL;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.language !== undefined) updateData.language = input.language;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.birthDate) {
      updateData.birthDate = Timestamp.fromDate(input.birthDate);
    } else if (input.birthDate === null) {
      updateData.birthDate = null;
    }

    await updateDoc(doc(this.firestore, 'users', uid), updateData);
  }
}
