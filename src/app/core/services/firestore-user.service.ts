import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  doc,
  docData,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { NewUserProfile, UserProfile } from '../models/user-profile.model';

/**
 * `users/{uid}` koleksiyonuna erişim için tek nokta. `AuthService` bu
 * servisin üstüne kurulur; Firestore çağrılarının hepsi burada toplanır ki
 * ileride (paketler, admin panel vb.) tekrar kullanılabilsin.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreUserService {
  private readonly firestore = inject(Firestore);

  private userDoc(uid: string) {
    return doc(this.firestore, 'users', uid);
  }

  /** Gerçek zamanlı dinleyici — doküman henüz oluşmadıysa `undefined` yayar. */
  watchProfile(uid: string): Observable<UserProfile | undefined> {
    return docData(this.userDoc(uid)) as Observable<UserProfile | undefined>;
  }

  async getProfile(uid: string): Promise<UserProfile | undefined> {
    const snap = await getDoc(this.userDoc(uid));
    return snap.exists() ? (snap.data() as UserProfile) : undefined;
  }

  /**
   * Sadece fallback içindir: `createUserProfile` Cloud Function'ı auth
   * tetikleyicisinden henüz çalışmadıysa client kendi trial dokümanını
   * oluşturur. firestore.rules bu yazmayı sadece `role: 'user'`,
   * `membershipStatus: 'trial'` şekliyle ve makul bir `trialEndsAt` ile
   * sınırlar — bkz. firestore.rules.
   */
  async createTrialProfileIfMissing(profile: NewUserProfile): Promise<void> {
    const existing = await getDoc(this.userDoc(profile.uid));
    if (existing.exists()) {
      return;
    }
    await setDoc(this.userDoc(profile.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Kullanıcının kendi güncelleyebildiği tek alanlar. */
  async updateOwnProfile(
    uid: string,
    changes: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>,
  ): Promise<void> {
    await updateDoc(this.userDoc(uid), {
      ...changes,
      updatedAt: serverTimestamp(),
    });
  }

  /** İleride admin paneli için: 14 gün + client saatine güvenmeyen yardımcı. */
  static trialEndsAtFromNow(days: number): Timestamp {
    return Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
