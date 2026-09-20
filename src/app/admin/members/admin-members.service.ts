import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { deleteApp, initializeApp } from '@angular/fire/app';
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  arrayRemove,
  arrayUnion,
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
  branchId?: string | null;
  branchName?: string | null;
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
            [...list].sort(
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
      branchId: input.branchId || null,
      branchName: input.branchName || null,
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
      ...(input.branchId !== undefined ? { branchId: input.branchId || null } : {}),
      ...(input.branchName !== undefined ? { branchName: input.branchName || null } : {}),
      updatedAt: serverTimestamp(),
    });
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
