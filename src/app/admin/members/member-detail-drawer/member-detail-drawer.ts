import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { UserProfile, MembershipStatus } from '../../../core/models/user-profile.model';
import { WalletTransaction } from '../../../core/models/wallet-transaction.model';
import { AccessLog } from '../../../core/models/access-log.model';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';
import { WaterLog } from '../../../core/models/water-log.model';
import {
  WorkoutPlan,
  CreateWorkoutPlanInput,
  Exercise,
  DEFAULT_EXERCISE_LIBRARY,
} from '../../../core/models/workout-plan.model';
import {
  MemberDocument,
  CreateMemberDocumentInput,
  DocumentType,
  DocumentStatus,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from '../../../core/models/member-document.model';
import { ClassSchedule } from '../../../core/models/class-schedule.model';
import { MuscleGroup, MUSCLE_GROUP_LABELS, GymEquipment } from '../../../core/models/gym-equipment.model';
import { SportsDiscipline } from '../../../core/models/sports-discipline.model';
import { AdminMembersService } from '../admin-members.service';
import { AdminDisciplinesService } from '../../disciplines/admin-disciplines.service';
import { formatMoney, formatDateTime } from '../../../shared/ui/ui-utils';
import { Timestamp } from '@angular/fire/firestore';
import { SignaturePadModal } from '../../../shared/components/signature-pad-modal/signature-pad-modal';
import { WorkoutTemplatesService } from '../../../core/services/workout-templates.service';
import {
  WorkoutTemplate,
  FITNESS_LEVEL_LABELS,
  PROGRAM_GOAL_LABELS,
} from '../../../core/models/workout-template.model';

export type MemberDetailTab =
  | 'measurements'
  | 'water'
  | 'workout'
  | 'documents'
  | 'schedules'
  | 'wallet'
  | 'access'
  | 'overview';

const STATUS_LABEL: Record<MembershipStatus, string> = {
  trial: 'Deneme',
  active: 'Aktif',
  expired: 'Süresi Bitti',
  cancelled: 'İptal',
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

@Component({
  selector: 'app-member-detail-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatTooltipModule,
    SignaturePadModal,
    CdkDrag,
    CdkDragHandle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-detail-drawer.html',
  styleUrl: './member-detail-drawer.scss',
})
export class MemberDetailDrawer {
  private readonly membersService = inject(AdminMembersService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly templatesService = inject(WorkoutTemplatesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);

  readonly closed = output<void>();
  readonly editRequested = output<UserProfile>();
  readonly walletRequested = output<UserProfile>();

  protected readonly activeTab = signal<MemberDetailTab>('measurements');
  protected readonly isExpanded = signal(false);
  protected readonly cdkDrag = viewChild(CdkDrag);

  // Hazır Antrenman Şablonları (Templates)
  protected readonly workoutTemplates = toSignal(this.templatesService.watchTemplates(), { initialValue: [] });
  protected readonly selectedTemplateId = signal<string>('');
  protected readonly fitnessLevelLabels = FITNESS_LEVEL_LABELS;
  protected readonly programGoalLabels = PROGRAM_GOAL_LABELS;

  // Sub-modal signals
  protected readonly showCardModal = signal(false);
  protected readonly showQrModal = signal(false);
  protected readonly showTransferModal = signal(false);
  protected readonly showRenewModal = signal(false);
  protected readonly showSignatureModal = signal(false);
  protected readonly previewDocUrl = signal<string | null>(null);
  protected readonly previewDocTitle = signal<string>('');

  // Card assignment state
  protected readonly cardRfid = signal('');
  protected readonly cardFee = signal(150);
  protected readonly cardPaid = signal(true);
  protected readonly savingCard = signal(false);

  // Subscription transfer state
  protected readonly allMembers = toSignal(this.membersService.watchMembers(), { initialValue: [] });
  protected readonly transferTargetUid = signal('');
  protected readonly transferReason = signal('');
  protected readonly savingTransfer = signal(false);

  // Quick renewal state
  protected readonly renewPackageName = signal('Aylık Standart');
  protected readonly renewDurationDays = signal(30);
  protected readonly renewPrice = signal(1250);
  protected readonly renewPaymentMethod = signal<'cash' | 'card' | 'transfer'>('cash');
  protected readonly savingRenew = signal(false);

  // Telemetry signals
  protected readonly walletTransactions = signal<WalletTransaction[]>([]);
  protected readonly accessLogs = signal<AccessLog[]>([]);
  protected readonly measurements = signal<BodyMeasurement[]>([]);
  protected readonly waterLogs = signal<WaterLog[]>([]);
  protected readonly loadingTelemetry = signal(false);

  // Workout & Programs
  protected readonly workoutPlans = signal<WorkoutPlan[]>([]);
  protected readonly showAddWorkoutPlanForm = signal(false);
  protected readonly savingWorkoutPlan = signal(false);
  protected readonly workoutPlanTitle = signal('4 Günlük Bölgesel Split Programı');
  protected readonly workoutPlanNotes = signal('');
  protected readonly workoutPlanStartDate = signal(new Date().toISOString().substring(0, 10));
  protected readonly workoutPlanDisciplineId = signal<string>('');
  protected readonly currentPlanExercises = signal<Exercise[]>([]);
  protected readonly filterExerciseMuscle = signal<MuscleGroup | 'all'>('all');

  // Exercise builder sub-form
  protected readonly newExName = signal('');
  protected readonly newExMuscle = signal<MuscleGroup>('chest');
  protected readonly newExEquipment = signal('');
  protected readonly newExSets = signal(4);
  protected readonly newExReps = signal('10-12');
  protected readonly newExWeight = signal<number | null>(null);
  protected readonly newExRest = signal(60);
  protected readonly newExNotes = signal('');

  // Documents & Licenses
  protected readonly memberDocuments = signal<MemberDocument[]>([]);
  protected readonly showAddDocForm = signal(false);
  protected readonly savingDoc = signal(false);
  protected readonly docType = signal<DocumentType>('health_report');
  protected readonly docName = signal('Spor Yapabilir Sağlık Raporu');
  protected readonly docDisciplineId = signal<string>('');
  protected readonly docIssueDate = signal(new Date().toISOString().substring(0, 10));
  protected readonly docExpiryDate = signal('');
  protected readonly docStatus = signal<DocumentStatus>('approved');
  protected readonly docNotes = signal('');

  // Class Schedules & Roster
  protected readonly enrolledSchedules = signal<ClassSchedule[]>([]);
  protected readonly allTenantSchedules = signal<ClassSchedule[]>([]);

  // Disciplines & Equipment
  protected readonly disciplines = signal<SportsDiscipline[]>([]);
  protected readonly equipmentList = signal<GymEquipment[]>([]);

  // Static options & labels
  protected readonly defaultExerciseLibrary = DEFAULT_EXERCISE_LIBRARY;
  protected readonly muscleGroupLabels: Record<string, string> = MUSCLE_GROUP_LABELS;
  protected readonly docTypeLabels: Record<string, string> = DOCUMENT_TYPE_LABELS;
  protected readonly docStatusLabels: Record<string, string> = DOCUMENT_STATUS_LABELS;
  protected readonly muscleGroupsList: { key: MuscleGroup; label: string }[] = [
    { key: 'chest', label: 'Göğüs (Chest)' },
    { key: 'back', label: 'Sırt & Kanat (Back)' },
    { key: 'shoulders', label: 'Omuz (Shoulders)' },
    { key: 'legs', label: 'Bacak (Legs)' },
    { key: 'arms', label: 'Kol / Biceps-Triceps' },
    { key: 'core', label: 'Karın / Core' },
    { key: 'fullbody', label: 'Tüm Vücut (Full Body)' },
  ];

  // Form toggles & states
  protected readonly showAddMeasurementForm = signal(false);
  protected readonly savingMeasurement = signal(false);
  protected readonly savingWater = signal(false);
  protected readonly customWaterAmount = signal<number>(250);
  protected readonly customWaterNote = signal<string>('');

  protected readonly measurementForm: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    weight: [null, [Validators.min(20), Validators.max(300)]],
    height: [null, [Validators.min(50), Validators.max(250)]],
    bodyFatPercentage: [null, [Validators.min(1), Validators.max(70)]],
    chest: [null, [Validators.min(30), Validators.max(200)]],
    waist: [null, [Validators.min(30), Validators.max(200)]],
    hips: [null, [Validators.min(30), Validators.max(200)]],
    bicep: [null, [Validators.min(10), Validators.max(80)]],
    thigh: [null, [Validators.min(20), Validators.max(120)]],
    calf: [null, [Validators.min(15), Validators.max(80)]],
    notes: [''],
  });

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusBadgeClass = STATUS_BADGE_CLASS;
  protected readonly money = formatMoney;

  /** Kalan gün hesabı */
  protected readonly daysLeft = computed(() => {
    const m = this.member();
    if (!m) return 0;
    const endTs = m.membershipStatus === 'trial' ? m.trialEndsAt : m.membershipEndsAt;
    if (!endTs) return null;
    const diffMs = endTs.toMillis() - Date.now();
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  });

  /** Son ölçüm kaydı */
  protected readonly latestMeasurement = computed(() => {
    const list = this.measurements();
    return list.length > 0 ? list[0] : null;
  });

  /** Bir önceki ölçüm (delta kilo hesabı için) */
  protected readonly previousMeasurement = computed(() => {
    const list = this.measurements();
    return list.length > 1 ? list[1] : null;
  });

  /** Kilo farkı (örn: -1.2 kg ya da +0.5 kg) */
  protected readonly weightDelta = computed(() => {
    const curr = this.latestMeasurement()?.weight;
    const prev = this.previousMeasurement()?.weight;
    if (curr === undefined || curr === null || prev === undefined || prev === null) {
      return null;
    }
    const diff = +(curr - prev).toFixed(1);
    return diff;
  });

  /** Son boy bilgisi */
  protected readonly currentHeight = computed(() => {
    const list = this.measurements();
    for (const m of list) {
      if (m.height) return m.height;
    }
    return null;
  });

  /** Vücut Kitle Endeksi (BMI) */
  protected readonly bmiInfo = computed(() => {
    const w = this.latestMeasurement()?.weight;
    const h = this.currentHeight();
    if (!w || !h || h <= 0) return null;
    const hM = h / 100;
    const val = +(w / (hM * hM)).toFixed(1);

    if (val < 18.5) {
      return { val, label: 'Zayıf', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (val <= 24.9) {
      return { val, label: 'İdeal / Normal', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (val <= 29.9) {
      return { val, label: 'Fazla Kilolu', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' };
    }
    return { val, label: 'Obez', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
  });

  /** Bugün içilen toplam su (ml) */
  protected readonly todayWaterTotal = computed(() => {
    const logs = this.waterLogs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;

    return logs
      .filter((l) => {
        const t = l.date?.toMillis() ?? 0;
        return t >= todayMs && t < tomorrowMs;
      })
      .reduce((sum, l) => sum + (l.amount || 0), 0);
  });

  /** Günlük hedef (3000 ml varsayılan) ve yüzde */
  protected readonly waterTarget = 3000;
  protected readonly waterProgressPercent = computed(() => {
    const total = this.todayWaterTotal();
    return Math.min(100, Math.round((total / this.waterTarget) * 100));
  });

  /** Son 30 gündeki toplam turnike girişi */
  protected readonly monthlyVisits = computed(() => {
    const logs = this.accessLogs();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(
      (l) => l.status === 'granted' && l.direction === 'in' && (l.timestamp?.toMillis() ?? 0) >= thirtyDaysAgo,
    ).length;
  });

  constructor() {
    effect((onCleanup) => {
      const isOpened = this.open();
      const current = this.member();

      if (!isOpened || !current?.uid) {
        this.walletTransactions.set([]);
        this.accessLogs.set([]);
        this.measurements.set([]);
        this.waterLogs.set([]);
        this.workoutPlans.set([]);
        this.memberDocuments.set([]);
        this.enrolledSchedules.set([]);
        this.allTenantSchedules.set([]);
        this.disciplines.set([]);
        this.equipmentList.set([]);
        this.showAddMeasurementForm.set(false);
        this.showAddWorkoutPlanForm.set(false);
        this.showAddDocForm.set(false);
        this.cdkDrag()?.reset();
        return;
      }

      this.loadingTelemetry.set(true);

      const walletSub = this.membersService
        .watchMemberWalletTransactions(current.uid)
        .subscribe((txs) => {
          const sorted = [...txs].sort(
            (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
          );
          this.walletTransactions.set(sorted);
          this.loadingTelemetry.set(false);
        });

      const accessSub = this.membersService
        .watchMemberAccessLogs(current.uid)
        .subscribe((logs) => {
          const sorted = [...logs].sort(
            (a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0),
          );
          this.accessLogs.set(sorted);
        });

      const measureSub = this.membersService
        .watchMemberMeasurements(current.uid)
        .subscribe((list) => {
          const sorted = [...list].sort(
            (a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0),
          );
          this.measurements.set(sorted);
        });

      const waterSub = this.membersService
        .watchMemberWaterLogs(current.uid)
        .subscribe((logs) => {
          const sorted = [...logs].sort(
            (a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0),
          );
          this.waterLogs.set(sorted);
        });

      const workoutSub = this.membersService
        .watchMemberWorkoutPlans(current.uid)
        .subscribe((plans) => {
          this.workoutPlans.set(plans);
        });

      const docsSub = this.membersService
        .watchMemberDocuments(current.uid)
        .subscribe((docs) => {
          this.memberDocuments.set(docs);
        });

      const enrolledSub = this.membersService
        .watchMemberEnrolledSchedules(current.uid)
        .subscribe((schedules) => {
          this.enrolledSchedules.set(schedules);
        });

      const allSchedulesSub = this.membersService
        .watchTenantClassSchedules()
        .subscribe((schedules) => {
          this.allTenantSchedules.set(schedules);
        });

      const discSub = this.disciplinesService
        .watchDisciplines()
        .subscribe((discs) => {
          this.disciplines.set(discs);
        });

      const equipSub = this.disciplinesService
        .watchEquipment()
        .subscribe((eq) => {
          this.equipmentList.set(eq);
        });

      onCleanup(() => {
        walletSub.unsubscribe();
        accessSub.unsubscribe();
        measureSub.unsubscribe();
        waterSub.unsubscribe();
        workoutSub.unsubscribe();
        docsSub.unsubscribe();
        enrolledSub.unsubscribe();
        allSchedulesSub.unsubscribe();
        discSub.unsubscribe();
        equipSub.unsubscribe();
      });
    });
  }

  setTab(tab: MemberDetailTab): void {
    this.activeTab.set(tab);
  }

  close(): void {
    this.showAddMeasurementForm.set(false);
    this.cdkDrag()?.reset();
    this.closed.emit();
  }

  onEdit(): void {
    const m = this.member();
    if (m) this.editRequested.emit(m);
  }

  onWallet(): void {
    const m = this.member();
    if (m) this.walletRequested.emit(m);
  }

  toggleAddMeasurement(): void {
    this.showAddMeasurementForm.update((v) => !v);
    if (this.showAddMeasurementForm()) {
      this.measurementForm.patchValue({
        date: new Date().toISOString().substring(0, 10),
        weight: this.latestMeasurement()?.weight || null,
        height: this.currentHeight() || null,
      });
    }
  }

  async saveMeasurement(): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;
    if (this.measurementForm.invalid) {
      this.measurementForm.markAllAsTouched();
      return;
    }

    const val = this.measurementForm.value;
    const dateVal = val.date ? new Date(val.date) : new Date();

    this.savingMeasurement.set(true);
    try {
      await this.membersService.addBodyMeasurement(current.uid, {
        date: dateVal,
        weight: val.weight ? Number(val.weight) : undefined,
        height: val.height ? Number(val.height) : undefined,
        bodyFatPercentage: val.bodyFatPercentage ? Number(val.bodyFatPercentage) : undefined,
        chest: val.chest ? Number(val.chest) : undefined,
        waist: val.waist ? Number(val.waist) : undefined,
        hips: val.hips ? Number(val.hips) : undefined,
        bicep: val.bicep ? Number(val.bicep) : undefined,
        thigh: val.thigh ? Number(val.thigh) : undefined,
        calf: val.calf ? Number(val.calf) : undefined,
        notes: val.notes?.trim() || '',
      });

      this.snackBar.open('Vücut ölçümü ve kilo kaydı başarıyla eklendi.', 'Tamam', { duration: 3000 });
      this.showAddMeasurementForm.set(false);
      this.measurementForm.reset({
        date: new Date().toISOString().substring(0, 10),
      });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Ölçüm kaydedilemedi. Lütfen tekrar deneyin.', 'Kapat', { duration: 4000 });
    } finally {
      this.savingMeasurement.set(false);
    }
  }

  async deleteMeasurement(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Ölçüm Kaydı'))) return;
    try {
      await this.membersService.deleteBodyMeasurement(id);
      this.alertService.toastSuccess('Ölçüm kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme işlemi başarısız oldu.');
    }
  }

  async addQuickWater(amount: number, note = ''): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;
    this.savingWater.set(true);
    try {
      await this.membersService.addWaterLog(current.uid, {
        date: new Date(),
        amount,
        unit: 'ml',
        notes: note,
      });
      this.snackBar.open(`+${amount} ml su kaydı eklendi!`, 'Tamam', { duration: 2500 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Su kaydı eklenemedi.', 'Kapat', { duration: 3000 });
    } finally {
      this.savingWater.set(false);
    }
  }

  async addCustomWater(): Promise<void> {
    const amount = Number(this.customWaterAmount());
    if (!amount || amount <= 0) {
      this.snackBar.open('Geçerli bir su miktarı girin.', 'Kapat', { duration: 2500 });
      return;
    }
    await this.addQuickWater(amount, this.customWaterNote() || '');
    this.customWaterNote.set('');
  }

  async deleteWaterLog(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Su Tüketim Kaydı'))) return;
    try {
      await this.membersService.deleteWaterLog(id);
      this.alertService.toastSuccess('Su kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme başarısız.');
    }
  }

  formatDate(ts?: Timestamp | null): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatTime(ts?: Timestamp | null): string {
    if (!ts) return '—';
    return formatDateTime(ts);
  }

  getWhatsAppUrl(phone?: string | null): string {
    if (!phone) return '#';
    const clean = phone.replace(/[^0-9]/g, '');
    const intl = clean.startsWith('0') ? '90' + clean.slice(1) : clean;
    return `https://wa.me/${intl}`;
  }

  getCleanPhone(phone?: string | null): string {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '');
  }

  // ==========================================
  // BÖLGESEL ANTRENMAN PROGRAMI & ŞABLON METOTLARI
  // ==========================================

  applyTemplate(template: WorkoutTemplate): void {
    this.selectedTemplateId.set(template.id);
    this.workoutPlanTitle.set(template.title);
    this.workoutPlanNotes.set(template.description);
    this.workoutPlanDisciplineId.set(template.disciplineId || '');

    const clonedExercises: Exercise[] = template.exercises.map((ex, idx) => ({
      ...ex,
      id: `ex-${Date.now()}-${idx}`,
    }));

    this.currentPlanExercises.set(clonedExercises);
    this.snackBar.open(
      `"${template.title}" şablonu yüklendi! (${clonedExercises.length} egzersiz hazır)`,
      'Tamam',
      { duration: 3000 },
    );
  }

  async saveCurrentAsTemplate(): Promise<void> {
    const title = this.workoutPlanTitle().trim();
    const exercises = this.currentPlanExercises();

    if (!title || exercises.length === 0) {
      this.snackBar.open('Şablon olarak kaydetmek için lütfen başlık ve en az bir egzersiz ekleyin.', 'Kapat', {
        duration: 3000,
      });
      return;
    }

    try {
      await this.templatesService.createTemplate({
        title,
        level: 'intermediate',
        goal: 'split',
        targetDaysPerWeek: 4,
        description: this.workoutPlanNotes() || 'Antrenör tarafından salona özel oluşturulmuş şablon.',
        disciplineId: this.workoutPlanDisciplineId() || null,
        exercises,
      });
      this.alertService.toastSuccess(`"${title}" başarıyla yeni şablon olarak kaydedildi.`);
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Şablon kaydedilemedi.');
    }
  }

  toggleAddWorkoutPlan(): void {
    this.showAddWorkoutPlanForm.update((v) => !v);
    if (this.showAddWorkoutPlanForm()) {
      this.selectedTemplateId.set('');
      this.currentPlanExercises.set([]);
      this.workoutPlanTitle.set('4 Günlük Bölgesel Split Programı');
      this.workoutPlanNotes.set('');
      this.workoutPlanStartDate.set(new Date().toISOString().substring(0, 10));
      this.workoutPlanDisciplineId.set('');
    }
  }

  getAvailableLibraryExercises(): Exercise[] {
    const muscle = this.filterExerciseMuscle();
    if (muscle === 'all') return this.defaultExerciseLibrary;
    return this.defaultExerciseLibrary.filter((e) => e.muscleGroup === muscle);
  }

  addExerciseFromLibrary(ex: Exercise): void {
    const list = this.currentPlanExercises();
    this.currentPlanExercises.set([
      ...list,
      {
        ...ex,
        id: `ex-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      },
    ]);
    this.snackBar.open(`"${ex.name}" programa eklendi!`, 'Tamam', { duration: 1500 });
  }

  addCustomExercise(): void {
    const name = this.newExName().trim();
    if (!name) {
      this.snackBar.open('Lütfen hareket / egzersiz adı girin.', 'Kapat', { duration: 2500 });
      return;
    }

    const ex: Exercise = {
      id: `ex-${Date.now()}`,
      name,
      muscleGroup: this.newExMuscle(),
      equipmentName: this.newExEquipment().trim() || undefined,
      sets: Number(this.newExSets()) || 3,
      reps: this.newExReps() || '10-12',
      weight: this.newExWeight() ? Number(this.newExWeight()) : undefined,
      restSeconds: Number(this.newExRest()) || 60,
      notes: this.newExNotes().trim() || undefined,
    };

    this.currentPlanExercises.update((list) => [...list, ex]);
    this.newExName.set('');
    this.newExEquipment.set('');
    this.newExNotes.set('');
    this.snackBar.open(`"${name}" programa eklendi!`, 'Tamam', { duration: 1500 });
  }

  removeExerciseFromPlan(index: number): void {
    this.currentPlanExercises.update((list) => list.filter((_, i) => i !== index));
  }

  async saveWorkoutPlan(): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;

    if (this.currentPlanExercises().length === 0) {
      this.snackBar.open('Lütfen programa en az bir egzersiz ekleyin.', 'Kapat', { duration: 3000 });
      return;
    }

    this.savingWorkoutPlan.set(true);
    try {
      await this.membersService.addWorkoutPlan(current.uid, {
        title: this.workoutPlanTitle().trim() || 'Antrenman Programı',
        disciplineId: this.workoutPlanDisciplineId() || undefined,
        startDate: new Date(this.workoutPlanStartDate()),
        notes: this.workoutPlanNotes() || '',
        exercises: this.currentPlanExercises(),
      });

      this.snackBar.open('Bölgesel antrenman programı üyeye başarıyla atandı!', 'Tamam', { duration: 3000 });
      this.showAddWorkoutPlanForm.set(false);
      this.currentPlanExercises.set([]);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Program kaydedilemedi. Lütfen tekrar deneyin.', 'Kapat', { duration: 3000 });
    } finally {
      this.savingWorkoutPlan.set(false);
    }
  }

  async deleteWorkoutPlan(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Antrenman Programı'))) return;
    try {
      await this.membersService.deleteWorkoutPlan(id);
      this.alertService.toastSuccess('Antrenman programı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme işlemi başarısız.');
    }
  }

  // ==========================================
  // EVRAK & LİSANS METOTLARI
  // ==========================================

  toggleAddDoc(): void {
    this.showAddDocForm.update((v) => !v);
    if (this.showAddDocForm()) {
      this.docType.set('health_report');
      this.docName.set('Sağlık Raporu (Spor Yapabilir)');
      this.docDisciplineId.set('');
      this.docIssueDate.set(new Date().toISOString().substring(0, 10));
      this.docExpiryDate.set('');
      this.docStatus.set('approved');
      this.docNotes.set('');
    }
  }

  async saveMemberDoc(): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;

    if (!this.docName().trim()) {
      this.snackBar.open('Lütfen evrak adını girin.', 'Kapat', { duration: 2500 });
      return;
    }

    this.savingDoc.set(true);
    try {
      await this.membersService.addMemberDocument({
        userId: current.uid,
        disciplineId: this.docDisciplineId() || null,
        documentType: this.docType(),
        documentName: this.docName().trim(),
        issueDate: new Date(this.docIssueDate()),
        expiryDate: this.docExpiryDate() ? new Date(this.docExpiryDate()) : null,
        status: this.docStatus(),
        notes: this.docNotes() || '',
      });

      this.snackBar.open('Evrak / Lisans kaydı başarıyla eklendi.', 'Tamam', { duration: 3000 });
      this.showAddDocForm.set(false);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Evrak kaydedilemedi.', 'Kapat', { duration: 3000 });
    } finally {
      this.savingDoc.set(false);
    }
  }

  async updateDocStatus(id: string, status: DocumentStatus): Promise<void> {
    try {
      await this.membersService.updateMemberDocumentStatus(id, status);
      this.snackBar.open(`Evrak durumu "${this.docStatusLabels[status]}" olarak güncellendi.`, 'Tamam', {
        duration: 2500,
      });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Durum güncellenemedi.', 'Kapat', { duration: 2500 });
    }
  }

  async deleteMemberDoc(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Evrak / Lisans Kaydı'))) return;
    try {
      await this.membersService.deleteMemberDocument(id);
      this.alertService.toastSuccess('Evrak kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme işlemi başarısız.');
    }
  }

  // ==========================================
  // SEANS & ROSTER METOTLARI
  // ==========================================

  isEnrolledInSchedule(scheduleId: string): boolean {
    return this.enrolledSchedules().some((s) => s.id === scheduleId);
  }

  async toggleScheduleEnrollment(schedule: ClassSchedule, enroll: boolean): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;

    try {
      await this.membersService.toggleMemberEnrollmentInSchedule(schedule.id, current.uid, enroll);
      this.snackBar.open(
        enroll ? `Üye "${schedule.name}" seansına kaydedildi.` : `Üye "${schedule.name}" seansından çıkarıldı.`,
        'Tamam',
        { duration: 2500 },
      );
    } catch (err) {
      console.error(err);
      this.snackBar.open('İşlem başarısız oldu.', 'Kapat', { duration: 2500 });
    }
  }

  getDayName(dayOfWeek: number): string {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[dayOfWeek] ?? '';
  }

  getDisciplineName(disciplineId?: string | null): string {
    if (!disciplineId) return 'Genel Fitness';
    const found = this.disciplines().find((d) => d.id === disciplineId);
    return found ? found.name : 'Branş';
  }

  getMuscleGroupLabel(group?: MuscleGroup): string {
    if (!group) return 'Tüm Vücut';
    return this.muscleGroupLabels[group] || group;
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
    this.cdkDrag()?.reset();
  }

  // --- KART TANIMLAMA & DEPOZİTO METOTLARI ---
  openCardModal(): void {
    const m = this.member();
    this.cardRfid.set(m?.rfidCardNumber || '');
    this.cardFee.set(m?.cardDepositFee || 150);
    this.cardPaid.set(m?.cardDepositPaid ?? false);
    this.showCardModal.set(true);
  }

  async saveCardAssignment(): Promise<void> {
    const m = this.member();
    if (!m?.uid) return;
    if (!this.cardRfid().trim()) {
      this.snackBar.open('Lütfen RFID kart numarasını girin.', 'Kapat', { duration: 2500 });
      return;
    }

    this.savingCard.set(true);
    try {
      await this.membersService.updateCardAssignment(m.uid, m.displayName, {
        rfidCardNumber: this.cardRfid().trim(),
        cardDepositFee: this.cardFee(),
        cardDepositPaid: this.cardPaid(),
      });
      this.alertService.toastSuccess('Turnike kartı tanımlandı ve kaydedildi.');
      this.showCardModal.set(false);
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Kart tanımlanamadı.');
    } finally {
      this.savingCard.set(false);
    }
  }

  // --- MOBİL QR EKRANI ---
  openQrModal(): void {
    this.showQrModal.set(true);
  }

  // --- ABONELİK DEVRETME METOTLARI ---
  openTransferModal(): void {
    this.transferTargetUid.set('');
    this.transferReason.set('');
    this.showTransferModal.set(true);
  }

  async saveTransfer(): Promise<void> {
    const from = this.member();
    if (!from?.uid) return;
    const targetUid = this.transferTargetUid();
    if (!targetUid) {
      this.snackBar.open('Lütfen devredilecek üyeyi seçin.', 'Kapat', { duration: 2500 });
      return;
    }

    const target = this.allMembers().find((u) => u.uid === targetUid);
    if (!target) return;

    if (
      !(await this.alertService.actionConfirm(
        'Abonelik Devri Onayı',
        `"${from.displayName}" kullanıcısının kalan aboneliği "${target.displayName}" kullanıcısına devredilecek. Bu işlem geri alınamaz. Devam edilsin mi?`,
        'Evet, Devret',
      ))
    ) {
      return;
    }

    this.savingTransfer.set(true);
    try {
      await this.membersService.transferSubscription(from, target.uid, target.displayName, this.transferReason());
      this.alertService.toastSuccess('Abonelik başarıyla devredildi.');
      this.showTransferModal.set(false);
      this.close();
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Abonelik devredilemedi.');
    } finally {
      this.savingTransfer.set(false);
    }
  }

  // --- HIZLI ABONELİK YENİLEME METOTLARI ---
  openRenewModal(): void {
    this.renewPackageName.set(this.member()?.packageLabel || 'Aylık Standart');
    this.renewDurationDays.set(30);
    this.renewPrice.set(1250);
    this.showRenewModal.set(true);
  }

  onRenewPackageSelect(name: string, days: number, price: number): void {
    this.renewPackageName.set(name);
    this.renewDurationDays.set(days);
    this.renewPrice.set(price);
  }

  async saveRenew(): Promise<void> {
    const m = this.member();
    if (!m?.uid) return;

    if (
      !(await this.alertService.actionConfirm(
        'Abonelik Yenileme Onayı',
        `"${m.displayName}" için ${this.renewPackageName()} (${this.renewDurationDays()} gün) ${this.renewPrice()} ₺ tutarında yenilenecektir. Kasaya gelir kaydı işlenecektir. Onaylıyor musunuz?`,
        'Evet, Yenile',
      ))
    ) {
      return;
    }

    this.savingRenew.set(true);
    try {
      await this.membersService.renewMembership(m, {
        packageName: this.renewPackageName(),
        durationDays: this.renewDurationDays(),
        price: this.renewPrice(),
        paymentMethod: this.renewPaymentMethod(),
      });
      this.alertService.toastSuccess('Abonelik yenilendi ve muhasebe kaydı oluşturuldu.');
      this.showRenewModal.set(false);
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Yenileme işlemi başarısız.');
    } finally {
      this.savingRenew.set(false);
    }
  }

  // --- DİJİTAL İMZA PEDİ & SÖZLEŞME METOTLARI ---
  openSignatureModal(): void {
    this.showSignatureModal.set(true);
  }

  async onSignatureConfirmed(dataUrl: string): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;

    try {
      const todayStr = new Date().toLocaleDateString('tr-TR');
      await this.membersService.addMemberDocument({
        userId: current.uid,
        documentType: 'membership_agreement',
        documentName: `Dijital Üyelik & KVKK Sözleşmesi (${todayStr})`,
        fileUrl: dataUrl,
        issueDate: new Date(),
        status: 'approved',
        notes: 'Tablet / İmza Pedi üzerinden dijital ortamda ıslak imzalandı.',
      });
      this.alertService.toastSuccess('Üye sözleşmesi imzalandı ve evraklar arasına başarıyla kaydedildi.');
      this.showSignatureModal.set(false);
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Sözleşme kaydedilemedi.');
    }
  }

  openDocPreview(url: string, title = 'Belge Önizleme'): void {
    this.previewDocUrl.set(url);
    this.previewDocTitle.set(title);
  }

  closeDocPreview(): void {
    this.previewDocUrl.set(null);
  }
}

