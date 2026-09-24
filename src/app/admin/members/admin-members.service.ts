import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { deleteApp, initializeApp } from '@angular/fire/app';
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  arrayRemove,
  arrayUnion,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { Gender, MembershipStatus, UserProfile } from '../../core/models/user-profile.model';
import { WalletTransaction } from '../../core/models/wallet-transaction.model';
import { AccessLog } from '../../core/models/access-log.model';
import { BodyMeasurement, CreateBodyMeasurementInput } from '../../core/models/body-measurement.model';
import { WaterLog, CreateWaterLogInput } from '../../core/models/water-log.model';
import { WorkoutPlan, CreateWorkoutPlanInput } from '../../core/models/workout-plan.model';
import { MemberDocument, CreateMemberDocumentInput } from '../../core/models/member-document.model';
import { ClassSchedule } from '../../core/models/class-schedule.model';

export interface NewMemberInput {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  gender: Gender;
  birthDate: Date | null;
  membershipStatus: MembershipStatus;
  packageLabel: string | null;
  packagePrice?: number;
  branchId?: string | null;
  branchName?: string | null;
  /** Üyeliğin başladığı tarih */
  membershipStartDate: Date | null;
  /** Üyeliğin biteceği tarih */
  membershipEndDate: Date | null;
  notes: string;
  // Yeni eklenen alanlar
  memberNumber?: string;
  trainerId?: string | null;
  trainerName?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bloodGroup?: string | null;
  allergies?: string;
  chronicDiseases?: string;
  specialInfo?: string;
  photoURL?: string | null;
  rfidCardNumber?: string;
  cardDepositFee?: number;
  cardDepositPaid?: boolean;
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
  private readonly profile$ = toObservable(this.auth.profile);

  watchMembers(): Observable<UserProfile[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of([] as UserProfile[]);
        }
        const membersQuery = query(
          collection(this.firestore, 'users'),
          where('tenantId', '==', tenantId),
        );
        return (collectionData(membersQuery, { idField: 'uid' }) as Observable<UserProfile[]>).pipe(
          map((list) =>
            list
              .filter((u) => !u.role || u.role === 'user')
              .sort(
                (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
              ),
          ),
        );

      }),
    );
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
    const memberNumber = input.memberNumber?.trim() || Math.floor(10000 + Math.random() * 90000).toString();

    await setDoc(doc(this.firestore, 'users', uid), {
      uid,
      tenantId, // <-- admin'in KENDİ salonu; firestore.rules bunu ayrıca doğrular
      role: 'user',
      memberNumber,
      email: input.email.trim(),
      displayName: input.displayName.trim(),
      photoURL: input.photoURL || null,
      membershipStatus: input.membershipStatus,
      trialStartedAt: now,
      trialEndsAt: input.membershipStatus === 'trial' ? trialEndsAt : now,
      phone: input.phone.trim(),
      gender: input.gender,
      birthDate: input.birthDate ? Timestamp.fromDate(input.birthDate) : null,
      branchId: input.branchId || null,
      branchName: input.branchName || null,
      packageLabel: isActive ? input.packageLabel : null,
      membershipStartsAt: isActive && input.membershipStartDate ? Timestamp.fromDate(input.membershipStartDate) : null,
      membershipEndsAt: isActive && input.membershipEndDate ? Timestamp.fromDate(input.membershipEndDate) : null,
      trainerId: input.trainerId || null,
      trainerName: input.trainerName || null,
      emergencyContactName: input.emergencyContactName?.trim() || '',
      emergencyContactPhone: input.emergencyContactPhone?.trim() || '',
      emergencyContactRelation: input.emergencyContactRelation?.trim() || '',
      bloodGroup: input.bloodGroup || null,
      allergies: input.allergies?.trim() || '',
      chronicDiseases: input.chronicDiseases?.trim() || '',
      specialInfo: input.specialInfo?.trim() || '',
      rfidCardNumber: input.rfidCardNumber?.trim() || '',
      cardDepositFee: input.cardDepositFee ?? 0,
      cardDepositPaid: !!input.cardDepositPaid,
      notes: input.notes.trim(),
      createdAt: now,
      updatedAt: now,
    });

    // Otomatik Muhasebe Kaydı (Paket Satışı)
    if (isActive && (input.packagePrice ?? 0) > 0) {
      await addDoc(collection(this.firestore, 'accounting_entries'), {
        tenantId,
        type: 'income',
        amount: input.packagePrice,
        category: 'Üyelik & Paket Satışı',
        description: `${input.displayName} - ${input.packageLabel || 'Paket'} Kaydı`,
        referenceId: uid,
        referenceType: 'membership',
        paymentMethod: 'cash',
        notes: `5 Haneli Üye No: ${memberNumber}`,
        entryDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Otomatik Muhasebe Kaydı (Kart Depozitosu)
    if (input.cardDepositPaid && (input.cardDepositFee ?? 0) > 0) {
      await addDoc(collection(this.firestore, 'accounting_entries'), {
        tenantId,
        type: 'income',
        amount: input.cardDepositFee,
        category: 'Kart Depozito Bedeli',
        description: `${input.displayName} - Turnike/RFID Kart Depozitosu`,
        referenceId: uid,
        referenceType: 'card_deposit',
        paymentMethod: 'cash',
        notes: `5 Haneli Üye No: ${memberNumber} (Kart: ${input.rfidCardNumber || '-'})`,
        entryDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return uid;
  }

  async setMembershipStatus(uid: string, membershipStatus: MembershipStatus): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), {
      membershipStatus,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Bakiye yükler ya da düşer: cüzdan hareketi + `walletBalance` güncellemesi TEK
   * batch'te yazılır (biri olmadan diğeri kalmaz). Bakiye eksiye düşemez.
   */
  async adjustWallet(
    member: UserProfile,
    input: { type: 'deposit' | 'debit'; amount: number; description: string; paymentMethod: 'cash' | 'card' | 'transfer' },
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı — lütfen tekrar giriş yap.');
    if (!(input.amount > 0)) throw new Error('Tutar sıfırdan büyük olmalı.');
    const current = member.walletBalance ?? 0;
    if (input.type === 'debit' && input.amount > current) {
      throw new Error('Bakiye yetersiz.');
    }

    const batch = writeBatch(this.firestore);
    batch.set(doc(collection(this.firestore, 'wallet_transactions')), {
      userId: member.uid,
      tenantId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      status: 'completed',
      paymentMethod: input.paymentMethod,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(this.firestore, 'users', member.uid), {
      walletBalance: increment(input.type === 'deposit' ? input.amount : -input.amount),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  /** Üyenin PROFİL dokümanını siler; Firebase Auth hesabı (Spark planda) client'tan silinemez. */
  async deleteMember(uid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'users', uid));
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
      ...(input.memberNumber ? { memberNumber: input.memberNumber } : {}),
      ...(input.trainerId !== undefined ? { trainerId: input.trainerId, trainerName: input.trainerName } : {}),
      ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
      ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
      ...(input.emergencyContactRelation !== undefined ? { emergencyContactRelation: input.emergencyContactRelation } : {}),
      ...(input.bloodGroup !== undefined ? { bloodGroup: input.bloodGroup } : {}),
      ...(input.allergies !== undefined ? { allergies: input.allergies } : {}),
      ...(input.chronicDiseases !== undefined ? { chronicDiseases: input.chronicDiseases } : {}),
      ...(input.specialInfo !== undefined ? { specialInfo: input.specialInfo } : {}),
      ...(input.photoURL !== undefined ? { photoURL: input.photoURL } : {}),
      ...(input.rfidCardNumber !== undefined ? { rfidCardNumber: input.rfidCardNumber } : {}),
      ...(input.cardDepositFee !== undefined ? { cardDepositFee: input.cardDepositFee } : {}),
      ...(input.cardDepositPaid !== undefined ? { cardDepositPaid: input.cardDepositPaid } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}),
      ...(input.branchName !== undefined ? { branchName: input.branchName || null } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  /** Abonelik Devretme: kalan süreyi hedef üyeye aktarır, eski üyeyi iptal eder ve geçmiş kaydı tutar. */
  async transferSubscription(
    fromMember: UserProfile,
    toMemberUid: string,
    toMemberName: string,
    reason?: string,
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    const batch = writeBatch(this.firestore);

    // 1. Eski üyenin aboneliğini sonlandır ve not düş
    const fromRef = doc(this.firestore, 'users', fromMember.uid);
    batch.update(fromRef, {
      membershipStatus: 'cancelled',
      notes: `${fromMember.notes || ''}\n[Devredildi]: Abonelik ${toMemberName} üyesine aktarıldı (${new Date().toLocaleDateString('tr-TR')}).`,
      updatedAt: now,
    });

    // 2. Yeni üyeye paketi ve bitiş tarihini aktar
    const toRef = doc(this.firestore, 'users', toMemberUid);
    batch.update(toRef, {
      membershipStatus: 'active',
      packageLabel: fromMember.packageLabel || 'Devir Aboneliği',
      membershipStartsAt: now,
      membershipEndsAt: fromMember.membershipEndsAt || now,
      updatedAt: now,
    });

    // 3. Devir geçmişi kaydı
    const transferRef = doc(collection(this.firestore, 'subscription_transfers'));
    batch.set(transferRef, {
      tenantId,
      fromMemberUid: fromMember.uid,
      fromMemberName: fromMember.displayName,
      toMemberUid,
      toMemberName,
      packageLabel: fromMember.packageLabel || '',
      transferredAt: now,
      reason: reason || 'Kullanıcı talebiyle devir yapıldı.',
      createdAt: now,
    });

    await batch.commit();
  }

  /** Hızlı Abonelik Yenileme: Bitiş tarihini uzatır ve otomatik muhasebe kaydı oluşturur. */
  async renewMembership(
    member: UserProfile,
    input: {
      packageName: string;
      durationDays: number;
      price: number;
      paymentMethod?: 'cash' | 'card' | 'transfer' | 'wallet';
      notes?: string;
      recordAccounting?: boolean;
    },
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    let baseDate = new Date();
    if (member.membershipStatus === 'active' && member.membershipEndsAt) {
      const currentEndMs = member.membershipEndsAt.toMillis();
      if (currentEndMs > Date.now()) {
        baseDate = new Date(currentEndMs);
      }
    }
    baseDate.setDate(baseDate.getDate() + input.durationDays);
    const newEndsAt = Timestamp.fromDate(baseDate);

    const batch = writeBatch(this.firestore);
    const memberRef = doc(this.firestore, 'users', member.uid);
    const logNote = `[Abonelik Yenileme]: ${input.packageName} (${input.durationDays} Gün, ${input.price} ₺) - ${new Date().toLocaleDateString('tr-TR')}${input.notes ? ' - Not: ' + input.notes : ''}`;
    const updatedNotes = member.notes ? `${member.notes}\n${logNote}` : logNote;

    batch.update(memberRef, {
      membershipStatus: 'active',
      packageLabel: input.packageName,
      membershipEndsAt: newEndsAt,
      notes: updatedNotes,
      updatedAt: now,
    });

    if (input.price > 0 && input.recordAccounting !== false) {
      const entryRef = doc(collection(this.firestore, 'accounting_entries'));
      batch.set(entryRef, {
        tenantId,
        type: 'income',
        amount: input.price,
        category: 'Abonelik Yenileme',
        description: `${member.displayName} - ${input.packageName} (${input.durationDays} Gün) Yenileme`,
        referenceId: member.uid,
        referenceType: 'membership_renewal',
        paymentMethod: input.paymentMethod || 'cash',
        notes: input.notes || `5 Haneli Üye No: ${member.memberNumber || '-'}`,
        entryDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }

  /** Hızlı Süre Ekleme (Telafi / Bonus): Ücret almadan bitiş tarihini uzatır. */
  async extendMembershipDays(
    member: UserProfile,
    additionalDays: number,
    reason?: string,
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    let baseDate = new Date();
    if (member.membershipEndsAt) {
      const currentEndMs = member.membershipEndsAt.toMillis();
      if (currentEndMs > Date.now()) {
        baseDate = new Date(currentEndMs);
      }
    }
    baseDate.setDate(baseDate.getDate() + additionalDays);
    const newEndsAt = Timestamp.fromDate(baseDate);

    const memberRef = doc(this.firestore, 'users', member.uid);
    const logNote = `[Süre Eklendi]: +${additionalDays} Gün (${reason || 'Telafi/Hediye'}) - ${new Date().toLocaleDateString('tr-TR')}`;
    const updatedNotes = member.notes ? `${member.notes}\n${logNote}` : logNote;

    await updateDoc(memberRef, {
      membershipStatus: 'active',
      membershipEndsAt: newEndsAt,
      notes: updatedNotes,
      updatedAt: now,
    });
  }

  /** Abonelik Dondurma: Bitiş tarihini dondurma süresi kadar erteler. */
  async freezeMembership(
    member: UserProfile,
    freezeDays: number,
    reason?: string,
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    let baseDate = new Date();
    if (member.membershipEndsAt) {
      const currentEndMs = member.membershipEndsAt.toMillis();
      if (currentEndMs > Date.now()) {
        baseDate = new Date(currentEndMs);
      }
    }
    baseDate.setDate(baseDate.getDate() + freezeDays);
    const newEndsAt = Timestamp.fromDate(baseDate);

    const memberRef = doc(this.firestore, 'users', member.uid);
    const logNote = `[Donduruldu]: ${freezeDays} Gün donduruldu (${reason || 'Üye talebi'}) - ${new Date().toLocaleDateString('tr-TR')}`;
    const updatedNotes = member.notes ? `${member.notes}\n${logNote}` : logNote;

    await updateDoc(memberRef, {
      membershipEndsAt: newEndsAt,
      notes: updatedNotes,
      updatedAt: now,
    });
  }

  /** Aboneliği İptal Et */
  async cancelMembership(member: UserProfile, reason?: string): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    const memberRef = doc(this.firestore, 'users', member.uid);
    const logNote = `[İptal Edildi]: ${reason || 'Yönetici tarafından iptal edildi.'} - ${new Date().toLocaleDateString('tr-TR')}`;
    const updatedNotes = member.notes ? `${member.notes}\n${logNote}` : logNote;

    await updateDoc(memberRef, {
      membershipStatus: 'cancelled',
      notes: updatedNotes,
      updatedAt: now,
    });
  }

  /** Üyeye RFID / Turnike Kartı Tanımlama ve Depozito Ücretini Kasaya İşleme */
  async updateCardAssignment(
    memberUid: string,
    memberName: string,
    cardData: { rfidCardNumber: string; cardDepositFee: number; cardDepositPaid: boolean },
  ): Promise<void> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const now = Timestamp.now();
    const batch = writeBatch(this.firestore);

    const memberRef = doc(this.firestore, 'users', memberUid);
    batch.update(memberRef, {
      rfidCardNumber: cardData.rfidCardNumber.trim(),
      cardDepositFee: cardData.cardDepositFee,
      cardDepositPaid: cardData.cardDepositPaid,
      updatedAt: now,
    });

    if (cardData.cardDepositPaid && cardData.cardDepositFee > 0) {
      const entryRef = doc(collection(this.firestore, 'accounting_entries'));
      batch.set(entryRef, {
        tenantId,
        type: 'income',
        amount: cardData.cardDepositFee,
        category: 'Kart Depozito Bedeli',
        description: `${memberName} - Turnike / RFID Kart Depozitosu (Kart No: ${cardData.rfidCardNumber})`,
        referenceId: memberUid,
        referenceType: 'card_deposit',
        paymentMethod: 'cash',
        notes: 'Turnike kartı tanımlama depozitosu',
        entryDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
  }

  /** Belirli bir üyenin cüzdan geçmişini dinler */
  watchMemberWalletTransactions(userId: string): Observable<WalletTransaction[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as WalletTransaction[]);
        const q = query(
          collection(this.firestore, 'wallet_transactions'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<WalletTransaction[]>;
      }),
    );
  }

  /** Belirli bir üyenin turnike geçiş geçmişini dinler */
  watchMemberAccessLogs(userId: string): Observable<AccessLog[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as AccessLog[]);
        const q = query(
          collection(this.firestore, 'access_logs'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<AccessLog[]>;
      }),
    );
  }

  /** Belirli bir üyenin vücut ölçüm geçmişini dinler */
  watchMemberMeasurements(userId: string): Observable<BodyMeasurement[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as BodyMeasurement[]);
        const q = query(
          collection(this.firestore, 'body_measurements'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<BodyMeasurement[]>;
      }),
    );
  }

  /** Belirli bir üyenin su takip kayıtlarını dinler */
  watchMemberWaterLogs(userId: string): Observable<WaterLog[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as WaterLog[]);
        const q = query(
          collection(this.firestore, 'water_logs'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<WaterLog[]>;
      }),
    );
  }

  /** Yeni vücut ölçümü / kilo kaydı ekler */
  async addBodyMeasurement(userId: string, input: CreateBodyMeasurementInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const colRef = collection(this.firestore, 'body_measurements');
    const newDoc = doc(colRef);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      userId,
      tenantId,
      date: Timestamp.fromDate(input.date),
      ...(input.weight !== undefined && input.weight !== null ? { weight: Number(input.weight) } : {}),
      ...(input.height !== undefined && input.height !== null ? { height: Number(input.height) } : {}),
      ...(input.chest !== undefined && input.chest !== null ? { chest: Number(input.chest) } : {}),
      ...(input.waist !== undefined && input.waist !== null ? { waist: Number(input.waist) } : {}),
      ...(input.hips !== undefined && input.hips !== null ? { hips: Number(input.hips) } : {}),
      ...(input.bicep !== undefined && input.bicep !== null ? { bicep: Number(input.bicep) } : {}),
      ...(input.thigh !== undefined && input.thigh !== null ? { thigh: Number(input.thigh) } : {}),
      ...(input.calf !== undefined && input.calf !== null ? { calf: Number(input.calf) } : {}),
      ...(input.bodyFatPercentage !== undefined && input.bodyFatPercentage !== null
        ? { bodyFatPercentage: Number(input.bodyFatPercentage) }
        : {}),
      notes: input.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  /** Yeni su tüketim kaydı ekler */
  async addWaterLog(userId: string, input: CreateWaterLogInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const colRef = collection(this.firestore, 'water_logs');
    const newDoc = doc(colRef);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      userId,
      tenantId,
      date: Timestamp.fromDate(input.date),
      amount: Number(input.amount),
      unit: input.unit || 'ml',
      notes: input.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  /** Vücut ölçümünü siler */
  async deleteBodyMeasurement(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'body_measurements', id));
  }

  /** Su kaydını siler */
  async deleteWaterLog(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'water_logs', id));
  }

  /** Belirli bir üyenin antrenman programlarını dinler */
  watchMemberWorkoutPlans(userId: string): Observable<WorkoutPlan[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as WorkoutPlan[]);
        const q = query(
          collection(this.firestore, 'workout_plans'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<WorkoutPlan[]>).pipe(
          map((plans) =>
            [...plans].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  /** Üyeye yeni bölgesel antrenman programı atar */
  async addWorkoutPlan(userId: string, input: CreateWorkoutPlanInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const trainerProfile = this.auth.profile();
    const colRef = collection(this.firestore, 'workout_plans');
    const newDoc = doc(colRef);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      userId,
      tenantId,
      trainerId: trainerProfile?.uid || null,
      trainerName: trainerProfile?.displayName || 'Baş Antrenör',
      disciplineId: input.disciplineId || null,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      exercises: input.exercises || [],
      startDate: Timestamp.fromDate(input.startDate),
      endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
      status: 'active',
      notes: input.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  /** Antrenman programını siler */
  async deleteWorkoutPlan(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'workout_plans', id));
  }

  /** Belirli bir üyenin evrak ve lisanslarını dinler */
  watchMemberDocuments(userId: string): Observable<MemberDocument[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId || !userId) return of([] as MemberDocument[]);
        const q = query(
          collection(this.firestore, 'member_documents'),
          where('tenantId', '==', tenantId),
          where('userId', '==', userId),
        );
        return (collectionData(q, { idField: 'id' }) as Observable<MemberDocument[]>).pipe(
          map((docs) =>
            [...docs].sort(
              (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
            ),
          ),
        );
      }),
    );
  }

  /** Üyeye yeni evrak / lisans kaydı ekler */
  async addMemberDocument(input: CreateMemberDocumentInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const adminUser = this.auth.profile();
    const colRef = collection(this.firestore, 'member_documents');
    const newDoc = doc(colRef);
    const now = serverTimestamp();

    await setDoc(newDoc, {
      id: newDoc.id,
      userId: input.userId,
      tenantId,
      disciplineId: input.disciplineId || null,
      documentType: input.documentType,
      documentName: input.documentName.trim(),
      fileUrl: input.fileUrl || null,
      issueDate: Timestamp.fromDate(input.issueDate),
      expiryDate: input.expiryDate ? Timestamp.fromDate(input.expiryDate) : null,
      status: input.status,
      verifiedBy: input.status === 'approved' ? adminUser?.displayName || 'Yönetici' : null,
      verifiedAt: input.status === 'approved' ? now : null,
      notes: input.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    return newDoc.id;
  }

  /** Evrak durumunu günceller (onay/ret) */
  async updateMemberDocumentStatus(id: string, status: MemberDocument['status']): Promise<void> {
    const adminUser = this.auth.profile();
    const ref = doc(this.firestore, 'member_documents', id);
    await updateDoc(ref, {
      status,
      verifiedBy: status === 'approved' ? adminUser?.displayName || 'Yönetici' : null,
      verifiedAt: status === 'approved' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }

  /** Evrak kaydını siler */
  async deleteMemberDocument(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'member_documents', id));
  }

  /** Salondaki tüm seans / ders programlarını dinler */
  watchTenantClassSchedules(): Observable<ClassSchedule[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) return of([] as ClassSchedule[]);
        const q = query(
          collection(this.firestore, 'class_schedules'),
          where('tenantId', '==', tenantId),
        );
        return collectionData(q, { idField: 'id' }) as Observable<ClassSchedule[]>;
      }),
    );
  }

  /** Üyenin kayıtlı olduğu seansları getirir */
  watchMemberEnrolledSchedules(userId: string): Observable<ClassSchedule[]> {
    return this.watchTenantClassSchedules().pipe(
      map((schedules) =>
        schedules.filter(
          (s) => Array.isArray(s.enrolledMemberIds) && s.enrolledMemberIds.includes(userId),
        ),
      ),
    );
  }

  /** Üyeyi bir seansa ekler veya seans listesinden çıkarır */
  async toggleMemberEnrollmentInSchedule(
    scheduleId: string,
    userId: string,
    enroll: boolean,
  ): Promise<void> {
    const ref = doc(this.firestore, 'class_schedules', scheduleId);
    if (enroll) {
      await updateDoc(ref, {
        enrolledMemberIds: arrayUnion(userId),
        currentBookings: increment(1),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        enrolledMemberIds: arrayRemove(userId),
        currentBookings: increment(-1),
        updatedAt: serverTimestamp(),
      });
    }
  }
}
