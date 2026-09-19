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
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { Gender, MembershipStatus, UserProfile } from '../../core/models/user-profile.model';

export interface NewMemberInput {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  gender: Gender;
  birthDate: Date | null;
  membershipStatus: MembershipStatus;
  packageLabel: string | null;
  /** Üyeliğin başladığı tarih — hazır paket ya da "Özel Süre" fark etmez, her zaman elle seçilir. */
  membershipStartDate: Date | null;
  /** Üyeliğin biteceği tarih — hazır paket seçilse bile admin üzerine yazabilir. */
  membershipEndDate: Date | null;
  notes: string;
}

/** `createMember`'dan farkı: hesap (e-posta/şifre) alanları yok — sadece profil güncellenir. */
export type UpdateMemberInput = Omit<NewMemberInput, 'email' | 'password'>;

/**
 * Admin panelinin "Üye Kayıtları" ekranı için: tüm üyeleri listeler ve
 * yeni üye oluşturur.
 *
 * ⚠️ SPARK PLANI: Bu proje Blaze'e geçene kadar Cloud Functions
 * kullanamıyor (bkz. AuthService'teki not), o yüzden üye oluşturma da
 * CLIENT'TAN yapılır: `createUserWithEmailAndPassword` çağrıldığı Auth
 * örneğinin oturumunu otomatik olarak yeni kullanıcıya geçirir — admin
 * kendi oturumundan düşmesin diye bunu ayrı, tek kullanımlık bir ikincil
 * Firebase App örneği üzerinden yapıyoruz (ana app'in Auth'una hiç
 * dokunmuyoruz). İş Kuralı 2 ("admin sadece KENDİ salonuna üye ekler")
 * `firestore.rules`'daki `isAdmin() && request.resource.data.tenantId ==
 * myTenantId()` kontrolüyle sunucu tarafında zorlanır — `tenantId` burada
 * admin'in kendi profilinden okunsa da, client kötü niyetli olsa bile
 * rules bunu değiştirmesine izin vermez.
 */
@Injectable({ providedIn: 'root' })
export class AdminMembersService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchMembers(): Observable<UserProfile[]> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) {
      return new Observable<UserProfile[]>((subscriber) => subscriber.next([]));
    }
    const membersQuery = query(
      collection(this.firestore, 'users'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
    );
    return collectionData(membersQuery) as Observable<UserProfile[]>;
  }

  /** Yeni üyeyi Firebase Auth + Firestore'a kaydeder (bkz. sınıf yorumu — ikincil app üzerinden). */
  async createMember(input: NewMemberInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) {
      throw new Error('Salon bilgisi bulunamadı — lütfen tekrar giriş yap.');
    }

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
    const isActive = input.membershipStatus === 'active';
    const trialEndsAt = Timestamp.fromMillis(now.toMillis() + environment.trialDurationDays * 24 * 60 * 60 * 1000);

    await setDoc(doc(this.firestore, 'users', uid), {
      uid,
      tenantId, // <-- admin'in KENDİ salonu; firestore.rules bunu ayrıca doğrular
      role: 'user',
      email: input.email.trim(),
      displayName: input.displayName.trim(),
      photoURL: null,
      membershipStatus: input.membershipStatus,
      trialStartedAt: now,
      trialEndsAt: input.membershipStatus === 'trial' ? trialEndsAt : now,
      phone: input.phone.trim(),
      gender: input.gender,
      birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
      packageLabel: isActive ? input.packageLabel : null,
      membershipStartsAt: isActive && input.membershipStartDate ? Timestamp.fromDate(input.membershipStartDate) : null,
      membershipEndsAt: isActive && input.membershipEndDate ? Timestamp.fromDate(input.membershipEndDate) : null,
      notes: input.notes.trim(),
      createdAt: now,
      updatedAt: now,
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
    const isActive = input.membershipStatus === 'active';

    await updateDoc(doc(this.firestore, 'users', uid), {
      displayName: input.displayName,
      phone: input.phone,
      gender: input.gender,
      birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
      membershipStatus: input.membershipStatus,
      packageLabel: isActive ? input.packageLabel : null,
      membershipStartsAt: isActive && input.membershipStartDate ? Timestamp.fromDate(input.membershipStartDate) : null,
      membershipEndsAt: isActive && input.membershipEndDate ? Timestamp.fromDate(input.membershipEndDate) : null,
      notes: input.notes,
      updatedAt: serverTimestamp(),
    });
  }
}
