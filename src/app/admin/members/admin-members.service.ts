import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, of, startWith, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { GymApi } from '../../core/api/gym.api';
import { AccessApi } from '../../core/api/access.api';
import { ClassesApi } from '../../core/api/classes.api';
import { DocumentsApi } from '../../core/api/documents.api';
import { HealthApi } from '../../core/api/health.api';
import { WalletApi } from '../../core/api/wallet.api';
import { WorkoutsApi } from '../../core/api/workouts.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { Gender, MembershipStatus, UserProfile } from '../../core/models/user-profile.model';
import { WalletTransaction } from '../../core/models/wallet-transaction.model';
import { AccessLog } from '../../core/models/access-log.model';
import { BodyMeasurement, CreateBodyMeasurementInput } from '../../core/models/body-measurement.model';
import { WaterLog, CreateWaterLogInput } from '../../core/models/water-log.model';
import { WorkoutPlan, CreateWorkoutPlanInput } from '../../core/models/workout-plan.model';
import { MemberDocument, CreateMemberDocumentInput } from '../../core/models/member-document.model';
import { ClassSchedule } from '../../core/models/class-schedule.model';

/**
 * Kayıtla birlikte satılan paket (yalnız yeni üye). Anlaşılan bedel `packagePrice` alanıyla gider;
 * paketin liste fiyatından düşükse fark indirim sayılır.
 */
export interface NewMemberSaleInput {
  /** Salon paketi; `null` = özel süre. */
  packageId: string | null;
  /** Kasaya giren tutar; paket bedelinden azsa fark borç + (-) cüzdan olur. */
  paidAmount?: number;
  /** Bilgi amaçlı (liste fiyatı − girilen bedel); sunucu bunu packagePrice'tan kendisi hesaplar. */
  discount?: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  /** Kalan borcun ilk vadesi, YYYY-MM-DD. */
  debtDueDate?: string;
  debtInstallments?: number;
}

export interface NewMemberInput {
  sale?: NewMemberSaleInput | null;
  displayName: string;
  email: string;
  phone: string;
  password: string;
  nationalId: string;
  gender: Gender;
  birthDate: Date | null;
  membershipStatus: MembershipStatus;
  packageLabel: string | null;
  packagePrice?: number;
  branchId?: string | null;
  branchName?: string | null;
  membershipStartDate: Date | null;
  membershipEndDate: Date | null;
  notes: string;
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
  kvkkConsent?: boolean | null;
  kvkkConsentAt?: string | null;
  commercialConsent?: boolean | null;
  commercialConsentAt?: string | null;
  healthConsent?: boolean | null;
  healthConsentAt?: string | null;
}

export type UpdateMemberInput = Omit<NewMemberInput, 'email' | 'password' | 'nationalId'> & {
  nationalId?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AdminMembersService {
  private readonly api = inject(GymApi);
  private readonly wallet = inject(WalletApi);
  private readonly access = inject(AccessApi);
  private readonly health = inject(HealthApi);
  private readonly workouts = inject(WorkoutsApi);
  private readonly documents = inject(DocumentsApi);
  private readonly classes = inject(ClassesApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchMembers(): Observable<UserProfile[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        if (!profile?.tenantId) {
          return of([] as UserProfile[]);
        }
        return this.reload$.pipe(
          startWith(null),
          switchMap(() => this.api.listMembers()),
        );
      }),
    );
  }

  private refresh(): void {
    this.reload$.next();
  }

  async createMember(input: NewMemberInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.createMember({
        ...this.toPayload(input),
        email: input.email,
        password: input.password,
        ...(input.sale
          ? {
              packageId: input.sale.packageId ?? undefined,
              paidAmount: input.sale.paidAmount,
              paymentMethod: input.sale.paymentMethod,
              debtDueDate: input.sale.debtDueDate,
              debtInstallments: input.sale.debtInstallments,
            }
          : {}),
      }),
    );
    // Eksik ödeme MainApi'de tek istekte işlenir: girilen paket bedeli ile alınan ücret arasındaki
    // fark Taksit & Borç Takibi'ne plan olarak eklenir ve cüzdana (-) yansır. Burada ayrıca plan
    // açmak ya da cüzdan hareketi yapmak borcu ikiye katlar.
    this.refresh();
    return created.uid;
  }

  async updateMember(uid: string, input: UpdateMemberInput): Promise<void> {
    await firstValueFrom(this.api.updateMember(uid, this.toPayload(input)));
    this.refresh();
  }

  async deleteMember(uid: string): Promise<void> {
    await firstValueFrom(this.api.deleteMember(uid));
    this.refresh();
  }

  async setMembershipStatus(uid: string, membershipStatus: MembershipStatus): Promise<void> {
    await firstValueFrom(this.api.updateMember(uid, { membershipStatus }));
    this.refresh();
  }

  async toggleArchiveMember(uid: string, isArchived: boolean): Promise<void> {
    await firstValueFrom(this.api.updateMember(uid, { isArchived }));
    this.refresh();
  }

  async renewMembership(
    member: UserProfile,
    input: {
      packageName: string;
      durationDays: number;
      price: number;
      notes?: string;
      paymentMethod?: string;
      recordAccounting?: boolean;
    },
  ): Promise<void> {
    await firstValueFrom(
      this.api.renewMember(member.uid, {
        packageName: input.packageName,
        durationDays: input.durationDays,
        price: input.price,
        notes: input.notes,
      }),
    );
    this.refresh();
  }

  async extendMembershipDays(member: UserProfile, additionalDays: number, reason?: string): Promise<void> {
    await firstValueFrom(this.api.freezeMember(member.uid, { freezeDays: additionalDays, reason }));
    this.refresh();
  }

  async freezeMembership(member: UserProfile, freezeDays: number, reason?: string): Promise<void> {
    await firstValueFrom(this.api.freezeMember(member.uid, { freezeDays, reason }));
    this.refresh();
  }

  async cancelMembership(member: UserProfile, reason?: string): Promise<void> {
    await firstValueFrom(this.api.cancelMember(member.uid, { reason }));
    this.refresh();
  }

  async adjustWallet(
    member: UserProfile,
    input: { type: 'deposit' | 'debit' | 'refund'; amount: number; description: string; paymentMethod?: string },
  ): Promise<void> {
    await firstValueFrom(
      this.wallet.adjust({
        userId: member.uid,
        walletType: input.type,
        amount: input.amount,
        description: input.description,
        paymentMethod: input.paymentMethod,
      }),
    );
    this.refresh();
  }

  async transferSubscription(
    from: UserProfile,
    targetUid: string,
    _targetName: string,
    reason?: string,
  ): Promise<void> {
    await firstValueFrom(
      this.api.updateMember(targetUid, {
        membershipStatus: from.membershipStatus,
        packageLabel: from.packageLabel,
        membershipStartDate: from.membershipStartsAt,
        membershipEndDate: from.membershipEndsAt,
        notes: reason,
      }),
    );
    await firstValueFrom(this.api.cancelMember(from.uid, { reason: reason || 'Abonelik devri' }));
    this.refresh();
  }

  async updateCardAssignment(
    memberUid: string,
    _memberName: string,
    cardData: { rfidCardNumber: string; cardDepositFee: number; cardDepositPaid: boolean },
  ): Promise<void> {
    await firstValueFrom(this.api.updateMember(memberUid, cardData));
    this.refresh();
  }

  watchMemberWalletTransactions(uid?: string): Observable<WalletTransaction[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.wallet.list({ userId: uid }));
  }

  watchMemberAccessLogs(uid?: string): Observable<AccessLog[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.access.listLogs({ userId: uid }));
  }

  watchMemberMeasurements(uid?: string): Observable<BodyMeasurement[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.health.listMeasurements({ userId: uid }));
  }

  watchMemberWaterLogs(uid?: string): Observable<WaterLog[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.health.listWater({ userId: uid }));
  }

  watchMemberWorkouts(uid?: string): Observable<WorkoutPlan[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.workouts.list({ userId: uid }));
  }

  watchMemberWorkoutPlans(uid?: string): Observable<WorkoutPlan[]> {
    return this.watchMemberWorkouts(uid);
  }

  watchMemberDocuments(uid?: string): Observable<MemberDocument[]> {
    if (!uid) return of([]);
    return tenantReload(this.profile$, this.reload$, () => this.documents.list({ userId: uid }));
  }

  watchMemberClassSchedules(uid?: string): Observable<ClassSchedule[]> {
    return this.watchTenantClassSchedules().pipe(
      switchMap((list) => of(list.filter((item) => (item.enrolledMemberIds ?? []).includes(uid || '')))),
    );
  }

  watchMemberEnrolledSchedules(uid?: string): Observable<ClassSchedule[]> {
    return this.watchMemberClassSchedules(uid);
  }

  watchTenantClassSchedules(): Observable<ClassSchedule[]> {
    return tenantReload(this.profile$, this.reload$, () => this.classes.list());
  }

  async addBodyMeasurement(uid: string, input: CreateBodyMeasurementInput): Promise<void> {
    await firstValueFrom(
      this.health.createMeasurement({
        ...input,
        userId: uid,
        date: input.date instanceof Date ? input.date.toISOString() : input.date,
      }),
    );
    this.refresh();
  }

  async deleteBodyMeasurement(id: string): Promise<void> {
    await firstValueFrom(this.health.removeMeasurement(id));
    this.refresh();
  }

  async addWaterLog(uid: string, input: CreateWaterLogInput): Promise<void> {
    await firstValueFrom(
      this.health.createWater({
        ...input,
        userId: uid,
        date: input.date instanceof Date ? input.date.toISOString() : input.date,
      }),
    );
    this.refresh();
  }

  async deleteWaterLog(id: string): Promise<void> {
    await firstValueFrom(this.health.removeWater(id));
    this.refresh();
  }

  async addWorkoutPlan(uid: string, input: CreateWorkoutPlanInput): Promise<void> {
    await firstValueFrom(
      this.workouts.create({
        ...input,
        userId: uid,
        startDate: input.startDate.toISOString(),
        endDate: input.endDate ? input.endDate.toISOString() : null,
      }),
    );
    this.refresh();
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    await firstValueFrom(this.workouts.remove(id));
    this.refresh();
  }

  async addMemberDocument(input: CreateMemberDocumentInput): Promise<void> {
    await firstValueFrom(
      this.documents.create({
        ...input,
        issueDate: input.issueDate.toISOString(),
        expiryDate: input.expiryDate ? input.expiryDate.toISOString() : null,
      }),
    );
    this.refresh();
  }

  async updateMemberDocumentStatus(id: string, status: MemberDocument['status']): Promise<void> {
    await firstValueFrom(this.documents.update(id, { status }));
    this.refresh();
  }

  async deleteMemberDocument(id: string): Promise<void> {
    await firstValueFrom(this.documents.remove(id));
    this.refresh();
  }

  async toggleMemberEnrollmentInSchedule(scheduleId: string, uid: string, enroll: boolean): Promise<void> {
    const schedule = await firstValueFrom(this.classes.get(scheduleId));
    const current = schedule.enrolledMemberIds ?? [];
    const next = enroll ? [...new Set([...current, uid])] : current.filter((id) => id !== uid);
    await firstValueFrom(this.classes.assignMembers(scheduleId, next));
    this.refresh();
  }

  private toPayload(input: UpdateMemberInput | NewMemberInput) {
    return {
      displayName: input.displayName,
      nationalId: input.nationalId ?? null,
      phone: input.phone,
      gender: input.gender,
      birthDate: input.birthDate ? input.birthDate.toISOString() : null,
      membershipStatus: input.membershipStatus,
      packageLabel: input.packageLabel,
      packagePrice: 'packagePrice' in input ? input.packagePrice : undefined,
      branchId: input.branchId,
      branchName: input.branchName,
      membershipStartDate: input.membershipStartDate ? input.membershipStartDate.toISOString() : null,
      membershipEndDate: input.membershipEndDate ? input.membershipEndDate.toISOString() : null,
      notes: input.notes,
      memberNumber: input.memberNumber,
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      bloodGroup: input.bloodGroup,
      allergies: input.allergies,
      chronicDiseases: input.chronicDiseases,
      specialInfo: input.specialInfo,
      photoURL: input.photoURL,
      rfidCardNumber: input.rfidCardNumber,
      cardDepositFee: input.cardDepositFee,
      cardDepositPaid: input.cardDepositPaid,
      kvkkConsent: input.kvkkConsent,
      kvkkConsentAt: input.kvkkConsentAt,
      commercialConsent: input.commercialConsent,
      commercialConsentAt: input.commercialConsentAt,
      healthConsent: input.healthConsent,
      healthConsentAt: input.healthConsentAt,
    };
  }
}
