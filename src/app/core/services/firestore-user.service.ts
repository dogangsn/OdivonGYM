import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, getDoc, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/user-profile.model';

/**
 * `users/{uid}` koleksiyonuna erişim için tek nokta. `AuthService` bu
 * servisin üstüne kurulur; Firestore çağrılarının hepsi burada toplanır ki
 * ileride (paketler, admin panel vb.) tekrar kullanılabilsin.
 *
 * Doküman OLUŞTURMA burada YOK — çok kiracılı modelde bu her zaman Admin SDK
 * üzerinden, Cloud Functions'tan yapılır (bkz. `functions/src/tenant/*` ve
 * `firestore.rules`: `users` koleksiyonunda client `create` izni yok).
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
}
