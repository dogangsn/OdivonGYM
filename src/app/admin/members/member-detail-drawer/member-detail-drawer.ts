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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../core/services/alert.service';
import { UserProfile, MembershipStatus } from '../../../core/models/user-profile.model';
import { WalletTransaction } from '../../../core/models/wallet-transaction.model';
import { AccessLog } from '../../../core/models/access-log.model';
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
import { formatMoney, formatDateTime, toMillis, toJsDate } from '../../../shared/ui/ui-utils';
import { Timestamp } from '@angular/fire/firestore';
import { SignaturePadModal } from '../../../shared/components/signature-pad-modal/signature-pad-modal';
import { WorkoutTemplatesService } from '../../../core/services/workout-templates.service';
import {
  WorkoutTemplate,
  FITNESS_LEVEL_LABELS,
  PROGRAM_GOAL_LABELS,
} from '../../../core/models/workout-template.model';
import { MemberBodyState } from './member-body.state';
import { MemberMeasurementsTab, MemberWaterTab } from './member-body-tabs';
import { firstValueFrom } from 'rxjs';
import { ConsentApi } from '../../../core/api/consent.api';
import { ConsentModal } from '../../../shared/components/consent-modal/consent-modal';
import { ConsentModalService } from '../../../shared/components/consent-modal/consent-modal.service';
import {
  ConsentLog,
  ConsentType,
  CONSENT_TYPE_LABELS,
  MemberConsentResponse,
} from '../../../core/models/consent.model';
import { DocumentDefinitionsService } from '../../../core/services/document-definitions.service';
import { DocumentDefinitionsModal } from '../../../shared/components/document-definitions-modal/document-definitions-modal';
import { AdminPackagesService } from '../../packages/admin-packages.service';

export interface RequiredDocChecklistItem {
  code: string;
  name: string;
  documentType: DocumentType;
  description?: string;
  sources: string[];
  status: 'missing' | 'approved' | 'pending' | 'expired' | 'rejected';
  statusLabel: string;
  uploadedDoc?: MemberDocument;
  isMissing: boolean;
}

export type MemberDetailTab =
  | 'measurements'
  | 'water'
  | 'workout'
  | 'documents'
  | 'schedules'
  | 'wallet'
  | 'access'
  | 'overview'
  | 'consents';

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
    ConsentModal,
    DocumentDefinitionsModal,
    CdkDrag,
    CdkDragHandle,
    MemberMeasurementsTab,
    MemberWaterTab,
  ],
  providers: [MemberBodyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-detail-drawer.html',
  styleUrl: './member-detail-drawer.scss',
})
export class MemberDetailDrawer {
  private readonly membersService = inject(AdminMembersService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly templatesService = inject(WorkoutTemplatesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly body = inject(MemberBodyState);
  private readonly consentApi = inject(ConsentApi);
  protected readonly consentModal = inject(ConsentModalService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly docDefsService = inject(DocumentDefinitionsService);
  private readonly packagesService = inject(AdminPackagesService);

  readonly open = input(false);
  readonly member = input<UserProfile | null>(null);

  readonly closed = output<void>();
  readonly editRequested = output<UserProfile>();
  readonly walletRequested = output<UserProfile>();

  protected readonly activeTab = signal<MemberDetailTab>('overview');
  protected readonly isExpanded = signal(false);
  protected readonly cdkDrag = viewChild(CdkDrag);

  // KVKK Açık Rıza Durumu ve Logları
  protected readonly memberConsents = signal<MemberConsentResponse | null>(null);
  protected readonly loadingConsents = signal(false);
  protected readonly revokingConsentType = signal<string | null>(null);

  getConsentTypeLabel(type: ConsentType): string {
    return CONSENT_TYPE_LABELS[type] || type;
  }

  async loadConsents(memberId: string) {
    this.loadingConsents.set(true);
    try {
      const data = await firstValueFrom(this.consentApi.getMemberConsents(memberId));
      this.memberConsents.set(data);
    } catch {
      this.memberConsents.set(null);
    } finally {
      this.loadingConsents.set(false);
    }
  }

  async revokeMemberConsent(type: ConsentType) {
    const m = this.member();
    if (!m) return;
    const confirmed = await this.alertService.confirm({
      title: 'Açık Rızayı Geri Çek',
      message: 'Üyenin bu açık rıza onayını geri çekmek istediğinize emin misiniz? Bu işlem yasal audit loguna işlenecektir.',
      confirmText: 'Evet, Rızayı Geri Çek',
      cancelText: 'Vazgeç',
      isDestructive: true,
    });
    if (!confirmed) return;

    this.revokingConsentType.set(type);
    try {
      await firstValueFrom(
        this.consentApi.revokeConsent({
          memberId: m.uid,
          consentType: type,
          reason: 'Yönetim panelinden personel tarafından geri çekildi',
          channel: 'ADMIN_PANEL',
        }),
      );
      this.snackBar.open('Açık rıza başarıyla geri çekildi.', 'Kapat', { duration: 3000 });
      await this.loadConsents(m.uid);
    } catch {
      this.snackBar.open('İşlem başarısız oldu.', 'Kapat', { duration: 3000 });
    } finally {
      this.revokingConsentType.set(null);
    }
  }

  async openConsentText(type: ConsentType) {
    try {
      const texts = await firstValueFrom(this.consentApi.getActiveTexts());
      const text = texts.find((t) => t.type === type);
      if (text) {
        this.consentModal.open(text);
      }
    } catch {
      this.snackBar.open('Rıza metni yüklenemedi.', 'Kapat', { duration: 3000 });
    }
  }

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
  protected readonly previewDocType = signal<string>('');

  protected readonly isPdfDoc = computed(() => {
    const url = this.previewDocUrl();
    const type = this.previewDocType();
    const title = this.previewDocTitle();
    if (type && type.includes('pdf')) return true;
    if (title && title.toLowerCase().endsWith('.pdf')) return true;
    if (url && (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf'))) return true;
    return false;
  });

  protected readonly safeDocUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.previewDocUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

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
  protected readonly measurements = this.body.measurements;
  protected readonly waterLogs = this.body.waterLogs;
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
  protected readonly totalSuperSetsCount = computed(() =>
    this.currentPlanExercises().filter((e) => !!e.superSet).length,
  );
  protected readonly totalMovementsCount = computed(
    () => this.currentPlanExercises().length + this.totalSuperSetsCount(),
  );

  // Exercise builder sub-form
  protected readonly newExName = signal('');
  protected readonly newExMuscle = signal<MuscleGroup>('chest');
  protected readonly newExEquipment = signal('');
  protected readonly newExSets = signal(4);
  protected readonly newExReps = signal('10-12');
  protected readonly newExWeight = signal<number | null>(null);
  protected readonly newExRest = signal(60);
  protected readonly newExNotes = signal('');

  // Custom Exercise: Super Set inline toggle & fields
  protected readonly enableCustomSuperSet = signal(false);
  protected readonly superExName = signal('');
  protected readonly superExMuscle = signal<MuscleGroup>('arms');
  protected readonly superExEquipment = signal('');
  protected readonly superExSets = signal(4);
  protected readonly superExReps = signal('10-12');
  protected readonly superExWeight = signal<number | null>(null);
  protected readonly superExRest = signal(0);
  protected readonly superExNotes = signal('');

  // Super Set Link Modal / State (for adding/editing a super set on an existing exercise in Program Akışı)
  protected readonly superSetModalOpen = signal(false);
  protected readonly superSetTargetIndex = signal<number | null>(null);
  protected readonly superSetFilterMuscle = signal<MuscleGroup | 'all'>('all');
  protected readonly attachSuperName = signal('');
  protected readonly attachSuperMuscle = signal<MuscleGroup>('arms');
  protected readonly attachSuperEquipment = signal('');
  protected readonly attachSuperSets = signal(4);
  protected readonly attachSuperReps = signal('10-12');
  protected readonly attachSuperWeight = signal<number | null>(null);
  protected readonly attachSuperRest = signal(0);
  protected readonly attachSuperNotes = signal('');

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

  // File upload state for documents
  protected readonly selectedDocFile = signal<File | null>(null);
  protected readonly selectedDocDataUrl = signal<string>('');
  protected readonly selectedDocName = signal<string>('');
  protected readonly selectedDocType = signal<string>('');
  protected readonly selectedDocSize = signal<number>(0);
  protected readonly isDocFileProcessing = signal(false);
  protected readonly docFileDragOver = signal(false);

  // Required documents & definitions modal
  protected readonly showDocDefsModal = signal(false);
  protected readonly allPackages = toSignal(this.packagesService.watchPackages(), { initialValue: [] });

  /**
   * Üyenin paketi, kayıtlı olduğu seanslar, seçili branşlar ve salon genel kurallarına göre
   * zorunlu tutulan tüm evrakları ve üyenin teslim/onay durumunu hesaplar.
   */
  protected readonly memberRequiredDocChecklist = computed<RequiredDocChecklistItem[]>(() => {
    const currentMember = this.member();
    if (!currentMember?.uid) return [];

    const activeDefs = this.docDefsService.activeDefinitions();
    const enrolled = this.enrolledSchedules();
    const packages = this.allPackages();
    const uploadedDocs = this.memberDocuments();
    const allDiscs = this.disciplines();

    const reqSourcesMap = new Map<string, Set<string>>();

    const addReq = (code: string, source: string) => {
      if (!code) return;
      if (!reqSourcesMap.has(code)) {
        reqSourcesMap.set(code, new Set<string>());
      }
      reqSourcesMap.get(code)!.add(source);
    };

    // 1. Üyenin Paketi (Paketler kısmında ne seçimli ise ona göre zorunlu belgeler olacak)
    if (currentMember.packageLabel) {
      const pkgLabel = currentMember.packageLabel.trim().toLowerCase();
      const matchedPkg =
        packages.find((p) => p.name.trim().toLowerCase() === pkgLabel || p.id === currentMember.packageLabel) ||
        packages.find((p) => p.name.trim().toLowerCase().includes(pkgLabel) || pkgLabel.includes(p.name.trim().toLowerCase()));

      if (matchedPkg && matchedPkg.requiredDocuments && matchedPkg.requiredDocuments.length > 0) {
        for (const docCode of matchedPkg.requiredDocuments) {
          addReq(docCode, `Paket: ${matchedPkg.name}`);
        }
      }
    }

    // 3. Üyenin Kayıtlı Olduğu Seanslar (enrolledSchedules)
    for (const sch of enrolled) {
      if (sch.requiredDocuments && sch.requiredDocuments.length > 0) {
        for (const docCode of sch.requiredDocuments) {
          addReq(docCode, `Seans: ${sch.name}`);
        }
      }
      if (sch.disciplineId) {
        const disc = allDiscs.find((d) => d.id === sch.disciplineId);
        if (disc?.requiredDocuments?.length) {
          for (const docCode of disc.requiredDocuments) {
            addReq(docCode, `Branş: ${disc.name}`);
          }
        }
      }
    }

    const checklist: RequiredDocChecklistItem[] = [];

    for (const [code, sourcesSet] of reqSourcesMap.entries()) {
      const def = this.docDefsService.getDefinition(code);
      const name = def?.name || this.docDefsService.getLabel(code) || code;
      const documentType: DocumentType = def?.documentType || (code as DocumentType) || 'other';
      const description = def?.description || '';

      const matchingDocs = uploadedDocs.filter((d) => {
        if (d.documentType === code) return true;
        if (def && d.documentType === def.documentType) return true;
        if (def && d.documentName.toLowerCase().includes(def.name.toLowerCase())) return true;
        if (d.documentName.toLowerCase().includes(name.toLowerCase())) return true;
        return false;
      });

      let uploadedDoc: MemberDocument | undefined;
      if (matchingDocs.length > 0) {
        const statusPriority: Record<DocumentStatus, number> = {
          approved: 4,
          pending_review: 3,
          expired: 2,
          rejected: 1,
        };
        uploadedDoc = [...matchingDocs].sort((a, b) => {
          const pA = statusPriority[a.status] ?? 0;
          const pB = statusPriority[b.status] ?? 0;
          if (pA !== pB) return pB - pA;
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        })[0];
      }

      let status: 'missing' | 'approved' | 'pending' | 'expired' | 'rejected' = 'missing';
      let statusLabel = 'Doküman Bekleniyor';
      let isMissing = true;

      if (uploadedDoc) {
        if (uploadedDoc.status === 'approved') {
          status = 'approved';
          statusLabel = 'Onaylandı (Geçerli)';
          isMissing = false;
        } else if (uploadedDoc.status === 'pending_review') {
          status = 'pending';
          statusLabel = 'İnceleniyor (Onay Bekliyor)';
          isMissing = false;
        } else if (uploadedDoc.status === 'expired') {
          status = 'expired';
          statusLabel = 'Süresi Doldu (Yenileme Bekleniyor)';
          isMissing = true;
        } else if (uploadedDoc.status === 'rejected') {
          status = 'rejected';
          statusLabel = 'Reddedildi (Tekrar Yüklenmeli)';
          isMissing = true;
        }
      }

      checklist.push({
        code,
        name,
        documentType,
        description,
        sources: Array.from(sourcesSet),
        status,
        statusLabel,
        uploadedDoc,
        isMissing,
      });
    }

    const order: Record<string, number> = {
      missing: 1,
      expired: 2,
      rejected: 3,
      pending: 4,
      approved: 5,
    };
    return checklist.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  });

  protected readonly missingRequiredDocsCount = computed(() =>
    this.memberRequiredDocChecklist().filter((i) => i.isMissing).length,
  );

  startUploadForRequirement(item: RequiredDocChecklistItem): void {
    this.showAddDocForm.set(true);
    this.docName.set(item.name);
    this.docType.set(item.documentType);
    this.removeSelectedDocFile();
    this.activeTab.set('documents');
  }

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

  // Ölçüm ve su takibi durumu (sekmeler ve özet kartları ortak kullanır)
  protected readonly showAddMeasurementForm = this.body.showAddMeasurementForm;
  protected readonly latestMeasurement = this.body.latestMeasurement;
  protected readonly weightDelta = this.body.weightDelta;
  protected readonly currentHeight = this.body.currentHeight;
  protected readonly bmiInfo = this.body.bmiInfo;
  protected readonly todayWaterTotal = this.body.todayWaterTotal;
  protected readonly waterTarget = this.body.waterTarget;
  protected readonly waterProgressPercent = this.body.waterProgressPercent;

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusBadgeClass = STATUS_BADGE_CLASS;
  protected readonly money = formatMoney;
  protected readonly formatDateTime = formatDateTime;

  /** Kalan gün hesabı */
  protected readonly daysLeft = computed(() => {
    const m = this.member();
    if (!m) return 0;
    const endTs = m.membershipStatus === 'trial' ? m.trialEndsAt : m.membershipEndsAt;
    if (!endTs) return null;
    const diffMs = toMillis(endTs) - Date.now();
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  });

  /** Son 30 gündeki toplam turnike girişi */
  protected readonly monthlyVisits = computed(() => {
    const logs = this.accessLogs();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(
      (l) => l.status === 'granted' && l.direction === 'in' && toMillis(l.timestamp) >= thirtyDaysAgo,
    ).length;
  });

  constructor() {
    this.body.bind(() => this.member());

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
        this.memberConsents.set(null);
        this.cdkDrag()?.reset();
        return;
      }

      this.loadingTelemetry.set(true);
      this.activeTab.set('overview');
      this.loadConsents(current.uid);

      const walletSub = this.membersService
        .watchMemberWalletTransactions(current.uid)
        .subscribe((txs) => {
          const sorted = [...txs].sort(
            (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
          );
          this.walletTransactions.set(sorted);
          this.loadingTelemetry.set(false);
        });

      const accessSub = this.membersService
        .watchMemberAccessLogs(current.uid)
        .subscribe((logs) => {
          const sorted = [...logs].sort(
            (a, b) => toMillis(b.timestamp) - toMillis(a.timestamp),
          );
          this.accessLogs.set(sorted);
        });

      const measureSub = this.membersService
        .watchMemberMeasurements(current.uid)
        .subscribe((list) => {
          const sorted = [...list].sort(
            (a, b) => toMillis(b.date) - toMillis(a.date),
          );
          this.measurements.set(sorted);
        });

      const waterSub = this.membersService
        .watchMemberWaterLogs(current.uid)
        .subscribe((logs) => {
          const sorted = [...logs].sort(
            (a, b) => toMillis(b.date) - toMillis(a.date),
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

  formatDate(ts?: string | Timestamp | null): string {
    if (!ts) return '—';
    return toJsDate(ts)?.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '—';
  }

  formatTime(ts?: string | Timestamp | null): string {
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
    this.workoutPlanTitle.set(template.title || 'Antrenman Programı');
    this.workoutPlanNotes.set(template.description || '');
    this.workoutPlanDisciplineId.set(template.disciplineId || '');

    const clonedExercises: Exercise[] = (template.exercises || []).map((ex, idx) => ({
      ...ex,
      id: `ex-${Date.now()}-${idx}`,
    }));

    this.currentPlanExercises.set(clonedExercises);
    this.snackBar.open(
      `"${template.title || 'Şablon'}" şablonu yüklendi! (${clonedExercises.length} egzersiz hazır)`,
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

  getAvailableLibrarySuperSetExercises(): Exercise[] {
    const muscle = this.superSetFilterMuscle();
    if (muscle === 'all') return this.defaultExerciseLibrary;
    return this.defaultExerciseLibrary.filter((e) => e.muscleGroup === muscle);
  }

  openAddSuperSetModal(index: number): void {
    const target = this.currentPlanExercises()[index];
    if (!target) return;

    this.superSetTargetIndex.set(index);
    if (target.superSet) {
      this.attachSuperName.set(target.superSet.name || '');
      this.attachSuperMuscle.set(target.superSet.muscleGroup || 'arms');
      this.attachSuperEquipment.set(target.superSet.equipmentName || '');
      this.attachSuperSets.set(target.superSet.sets || target.sets || 4);
      this.attachSuperReps.set(target.superSet.reps ? String(target.superSet.reps) : '10-12');
      this.attachSuperWeight.set(target.superSet.weight ?? null);
      this.attachSuperRest.set(target.superSet.restSeconds ?? 0);
      this.attachSuperNotes.set(target.superSet.notes || '');
    } else {
      this.attachSuperName.set('');
      this.attachSuperMuscle.set('arms');
      this.attachSuperEquipment.set('');
      this.attachSuperSets.set(target.sets || 4);
      this.attachSuperReps.set('10-12');
      this.attachSuperWeight.set(null);
      this.attachSuperRest.set(0);
      this.attachSuperNotes.set('');
    }
    this.superSetFilterMuscle.set('all');
    this.superSetModalOpen.set(true);
  }

  pickLibraryForSuperSet(libEx: Exercise): void {
    this.attachSuperName.set(libEx.name);
    if (libEx.muscleGroup) this.attachSuperMuscle.set(libEx.muscleGroup);
    if (libEx.equipmentName) this.attachSuperEquipment.set(libEx.equipmentName);
    if (libEx.reps) this.attachSuperReps.set(String(libEx.reps));
    if (libEx.restSeconds !== undefined) this.attachSuperRest.set(libEx.restSeconds);
    this.snackBar.open(`"${libEx.name}" süper set hareketi olarak seçildi!`, 'Tamam', { duration: 1500 });
  }

  confirmAttachSuperSet(): void {
    const index = this.superSetTargetIndex();
    if (index === null || index < 0) return;

    const name = this.attachSuperName().trim();
    if (!name) {
      this.snackBar.open('Lütfen süper set hareket adını girin.', 'Kapat', { duration: 2500 });
      return;
    }

    const superSet: Exercise = {
      id: `ex-ss-${Date.now()}`,
      name,
      muscleGroup: this.attachSuperMuscle(),
      equipmentName: this.attachSuperEquipment().trim() || undefined,
      sets: Number(this.attachSuperSets()) || 4,
      reps: this.attachSuperReps() || '10-12',
      weight: this.attachSuperWeight() ? Number(this.attachSuperWeight()) : undefined,
      restSeconds: Number(this.attachSuperRest()) || 0,
      notes: this.attachSuperNotes().trim() || undefined,
    };

    this.currentPlanExercises.update((list) =>
      list.map((item, i) => (i === index ? { ...item, superSet } : item)),
    );

    this.superSetModalOpen.set(false);
    this.superSetTargetIndex.set(null);
    this.snackBar.open(`"${name}" süper set olarak başarıyla bağlandı! 🔗`, 'Tamam', { duration: 2500 });
  }

  removeSuperSet(index: number): void {
    this.currentPlanExercises.update((list) =>
      list.map((item, i) => {
        if (i === index) {
          const updated = { ...item };
          delete updated.superSet;
          return updated;
        }
        return item;
      }),
    );
    this.snackBar.open('Süper set bağlantısı kaldırıldı.', 'Tamam', { duration: 2000 });
  }

  addCustomExercise(): void {
    const name = this.newExName().trim();
    if (!name) {
      this.snackBar.open('Lütfen hareket / egzersiz adı girin.', 'Kapat', { duration: 2500 });
      return;
    }

    let superSet: Exercise | undefined = undefined;
    if (this.enableCustomSuperSet() && this.superExName().trim()) {
      superSet = {
        id: `ex-ss-${Date.now()}`,
        name: this.superExName().trim(),
        muscleGroup: this.superExMuscle(),
        equipmentName: this.superExEquipment().trim() || undefined,
        sets: Number(this.superExSets()) || Number(this.newExSets()) || 3,
        reps: this.superExReps() || '10-12',
        weight: this.superExWeight() ? Number(this.superExWeight()) : undefined,
        restSeconds: Number(this.superExRest()) || 0,
        notes: this.superExNotes().trim() || undefined,
      };
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
      superSet,
    };

    this.currentPlanExercises.update((list) => [...list, ex]);
    this.newExName.set('');
    this.newExEquipment.set('');
    this.newExNotes.set('');
    this.enableCustomSuperSet.set(false);
    this.superExName.set('');
    this.superExEquipment.set('');
    this.superExNotes.set('');
    this.snackBar.open(
      superSet
        ? `"${name}" ve bağlı süper seti ("${superSet.name}") programa eklendi! 🔗`
        : `"${name}" programa eklendi!`,
      'Tamam',
      { duration: 2500 },
    );
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
      this.removeSelectedDocFile();
    } else {
      this.removeSelectedDocFile();
    }
  }

  onDocFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processDocFile(input.files[0]);
    }
  }

  onDocDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.docFileDragOver.set(true);
  }

  onDocDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.docFileDragOver.set(false);
  }

  onDocDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.docFileDragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processDocFile(event.dataTransfer.files[0]);
    }
  }

  processDocFile(file: File): void {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext || '');

    if (!allowedTypes.includes(file.type) && !isAllowedExt) {
      this.alertService.toastError('Yalnızca PDF veya görsel (.jpg, .png, .webp) dosyaları yükleyebilirsiniz.');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.alertService.toastError('Dosya boyutu en fazla 10MB olabilir.');
      return;
    }

    this.isDocFileProcessing.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.selectedDocFile.set(file);
      this.selectedDocDataUrl.set(dataUrl);
      this.selectedDocName.set(file.name);
      this.selectedDocType.set(file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'));
      this.selectedDocSize.set(file.size);

      // Otomatik olarak evrak adını dosya adına göre güncelle (varsayılan ise veya boşsa)
      if (
        !this.docName().trim() ||
        this.docName() === 'Sağlık Raporu (Spor Yapabilir)' ||
        this.docName() === 'Spor Yapabilir Sağlık Raporu'
      ) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        this.docName.set(cleanName);
      }
      this.isDocFileProcessing.set(false);
    };
    reader.onerror = () => {
      this.alertService.toastError('Dosya okunamadı. Lütfen tekrar deneyin.');
      this.isDocFileProcessing.set(false);
    };
    reader.readAsDataURL(file);
  }

  removeSelectedDocFile(): void {
    this.selectedDocFile.set(null);
    this.selectedDocDataUrl.set('');
    this.selectedDocName.set('');
    this.selectedDocType.set('');
    this.selectedDocSize.set(0);
  }

  formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isPdf(doc: { fileType?: string | null; fileName?: string | null; fileUrl?: string | null }): boolean {
    if (doc.fileType?.includes('pdf')) return true;
    if (doc.fileName?.toLowerCase().endsWith('.pdf')) return true;
    if (doc.fileUrl?.startsWith('data:application/pdf') || doc.fileUrl?.toLowerCase().includes('.pdf')) return true;
    return false;
  }

  downloadDocFile(url: string | null | undefined, filename = 'belge'): void {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        fileUrl: this.selectedDocDataUrl() || null,
        fileName: this.selectedDocName() || null,
        fileType: this.selectedDocType() || null,
        fileSize: this.selectedDocSize() || null,
      });

      this.snackBar.open('Evrak / Lisans kaydı başarıyla eklendi.', 'Tamam', { duration: 3000 });
      this.showAddDocForm.set(false);
      this.removeSelectedDocFile();
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

  openDocPreview(url?: string | null, title = 'Belge Önizleme', fileType?: string | null): void {
    if (!url) return;
    this.previewDocUrl.set(url);
    this.previewDocTitle.set(title);
    this.previewDocType.set(fileType || '');
  }

  closeDocPreview(): void {
    this.previewDocUrl.set(null);
    this.previewDocTitle.set('');
    this.previewDocType.set('');
  }
}

