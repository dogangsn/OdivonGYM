import { Injectable, inject } from '@angular/core';
import { deleteApp, initializeApp } from '@angular/fire/app';
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gender, MembershipStatus, UserProfile } from '../../core/models/user-profile.model';

export interface NewMemberInput {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  gender: Gender;
  birthDate: Date | null;
  membershipStatus: MembershipStatus;
  /** Seçilen paketin gün sayısı — 'trial' seçiliyken kullanılmaz. */
  packageDays: number | null;
  packageLabel: string | null;
  notes: string;
}

/** `createMember`'dan farkı: hesap (e-posta/şifre) alanları yok — sadece profil güncellenir. */
export type UpdateMemberInput = Omit<NewMemberInput, 'email' | 'password'>;

/**
 * Admin panelinin "Üye Kayıtları" ekranı için: tüm üyeleri listeler ve
 * yeni üye oluşturur. `FirestoreUserService`'ten ayrı çünkü o sadece
 * OTURUM AÇMIŞ kullanıcının kendi dokümanıyla ilgilenir — burası admin'in
 * BAŞKA herhangi bir üye üzerinde çalışmasıyla ilgilenir (bkz.
 * firestore.rules `isAdmin()`).
 */
@Injectable({ providedIn: 'root' })
export class AdminMembersService {
  private readonly firestore = inject(Firestore);

  watchMembers(): Observable<UserProfile[]> {
    const membersQuery = query(collection(this.firestore, 'users'), orderBy('createdAt', 'desc'));
    return collectionData(membersQuery) as Observable<UserProfile[]>;
  }

  /**
   * Yeni üyeyi Firebase Auth + Firestore'a kaydeder.
   *
   * `createUserWithEmailAndPassword` çağrıldığı Auth örneğinin oturumunu
   * otomatik olarak yeni kullanıcıya geçirir — admin kendi oturumundan
   * düşmesin diye bunu ayrı, tek kullanımlık bir ikincil Firebase App
   * örneği üzerinden yapıyoruz (ana app'in Auth'una hiç dokunmuyoruz).
   */
  async createMember(input: NewMemberInput): Promise<string> {
    const secondaryApp = initializeApp(environment.firebase, `admin-create-${Date.now()}`);
    let uid: string;
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
      await updateProfile(credential.user, { displayName: input.displayName });
      uid = credential.user.uid;
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp).catch(() => undefined);
    }

    const now = Timestamp.now();
    const trialEndsAt = Timestamp.fromMillis(
      now.toMillis() + environment.trialDurationDays * 24 * 60 * 60 * 1000,
    );
    const membershipEndsAt = input.packageDays
      ? Timestamp.fromMillis(now.toMillis() + input.packageDays * 24 * 60 * 60 * 1000)
      : null;

    const profile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
      uid,
      email: input.email,
      displayName: input.displayName,
      photoURL: null,
      role: 'user',
      membershipStatus: input.membershipStatus,
      trialStartedAt: now,
      trialEndsAt: input.membershipStatus === 'trial' ? trialEndsAt : now,
      phone: input.phone,
      gender: input.gender,
      birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
      membershipEndsAt,
      packageLabel: input.packageLabel,
      notes: input.notes,
    };

    await setDoc(doc(this.firestore, 'users', uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return uid;
  }

  async setMembershipStatus(uid: string, membershipStatus: MembershipStatus): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), {
      membershipStatus,
      updatedAt: serverTimestamp(),
    });
  }

  /** Mevcut bir üyenin profil bilgilerini günceller (hesap/e-posta/şifre hariç). */
  async updateMember(uid: string, input: UpdateMemberInput): Promise<void> {
    const now = Timestamp.now();
    const isActive = input.membershipStatus === 'active';
    const membershipEndsAt = isActive && input.packageDays
      ? Timestamp.fromMillis(now.toMillis() + input.packageDays * 24 * 60 * 60 * 1000)
      : null;

    await updateDoc(doc(this.firestore, 'users', uid), {
      displayName: input.displayName,
      phone: input.phone,
      gender: input.gender,
      birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
      membershipStatus: input.membershipStatus,
      packageLabel: isActive ? input.packageLabel : null,
      membershipEndsAt,
      notes: input.notes,
      updatedAt: serverTimestamp(),
    });
  }
}
