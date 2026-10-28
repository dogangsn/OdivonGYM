import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { PermissionService } from '../../core/services/permission.service';
import { AdminDisciplinesService, normalizeDisciplineKey } from './admin-disciplines.service';
import {
  DisciplineCategory,
  DisciplineCode,
  SessionFormat,
  SportsDiscipline,
} from '../../core/models/sports-discipline.model';
import {
  GymEquipment,
  GymFacility,
  MUSCLE_GROUP_LABELS,
  MuscleGroup,
} from '../../core/models/gym-equipment.model';
import { DOCUMENT_TYPE_LABELS, DocumentType } from '../../core/models/member-document.model';
import { DEFAULT_EXERCISE_LIBRARY, Exercise } from '../../core/models/workout-plan.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { AdminShopService } from '../shop/admin-shop.service';
import { StockCategoryItem, resolveCategoryEmoji } from '../../core/models/stock-category.model';
import { ShopProduct } from '../../core/models/shop-product.model';
import { DocumentDefinitionsService } from '../../core/services/document-definitions.service';
import { DocumentDefinitionsModal } from '../../shared/components/document-definitions-modal/document-definitions-modal';
import { GymApi } from '../../core/api/gym.api';
import {
  GymMailTemplate,
  DEFAULT_MEMBER_MAIL_TEMPLATE,
  MAIL_TEMPLATE_VARIABLES,
  MailTemplateVariable,
} from '../../core/models/gym-mail-template.model';

export type DisciplinesTab =
  | 'disciplines'
  | 'muscles'
  | 'equipment'
  | 'facilities'
  | 'stock_categories'
  | 'mail_template';

export interface MuscleGroupDetail {
  key: MuscleGroup;
  title: string;
  latinName: string;
  icon: string;
  colorTag: string;
  description: string;
  primaryMuscles: string[];
}

export const MUSCLE_DETAILS: MuscleGroupDetail[] = [
  {
    key: 'chest',
    title: 'Göğüs',
    latinName: 'Pectoralis Major & Minor',
    icon: 'fitness_center',
    colorTag: 'indigo',
    description: 'İtiş hareketleri, göğüs kafesi genişletme ve üst gövde kütle gelişimi.',
    primaryMuscles: ['Üst Göğüs (Clavicular)', 'Orta Göğüs (Sternal)', 'Alt Göğüs (Abdominal)'],
  },
  {
    key: 'back',
    title: 'Sırt & Kanat',
    latinName: 'Latissimus Dorsi & Rhomboids',
    icon: 'sports_gymnastics',
    colorTag: 'emerald',
    description: 'Çekiş kuvveti, V-taper formu, duruş düzeltme ve omurga sağlığı.',
    primaryMuscles: ['Kanat (Lats)', 'Orta Sırt (Rhomboids)', 'Alt Sırt (Erector Spinae)'],
  },
  {
    key: 'shoulders',
    title: 'Omuz & Trapez',
    latinName: 'Deltoideus & Trapezius',
    icon: 'accessibility_new',
    colorTag: 'amber',
    description: 'Geniş omuz silueti, baş üstü itişler ve omuz kuşağı stabilitesi.',
    primaryMuscles: ['Ön Omuz (Anterior)', 'Yan Omuz (Lateral)', 'Arka Omuz (Posterior)', 'Trapez'],
  },
  {
    key: 'legs',
    title: 'Bacak & Kalf',
    latinName: 'Quadriceps, Hamstrings & Glutes',
    icon: 'directions_run',
    colorTag: 'rose',
    description: 'Tüm vücut güç temeli, kalça/kuadriseps hipertrofisi ve patlayıcı güç.',
    primaryMuscles: ['Ön Bacak (Quadriceps)', 'Arka Bacak (Hamstrings)', 'Kalça (Gluteus)', 'Kalf (Gastrocnemius)'],
  },
  {
    key: 'arms',
    title: 'Kol (Biceps & Triceps)',
    latinName: 'Biceps Brachii & Triceps Brachii',
    icon: 'sports_kabaddi',
    colorTag: 'purple',
    description: 'Kol çevresi gelişimi, dirsek eklemi sağlığı ve çekiş/itiş destek kuvveti.',
    primaryMuscles: ['Ön Kol (Biceps Brachii)', 'Arka Kol (Triceps Brachii)', 'Brakialis'],
  },
  {
    key: 'core',
    title: 'Karın & Core',
    latinName: 'Rectus Abdominis & Obliques',
    icon: 'self_improvement',
    colorTag: 'cyan',
    description: 'Gövde dengesi, intra-abdominal basınç ve rotasyonel kuvvet.',
    primaryMuscles: ['Baklavalar (Rectus Abdominis)', 'Yan Karın (Obliques)', 'Derin Core (Transversus)'],
  },
  {
    key: 'fullbody',
    title: 'Tüm Vücut / Kondisyon',
    latinName: 'Full Body Functional',
    icon: 'all_inclusive',
    colorTag: 'blue',
    description: 'Kardiyovasküler kapasite, metabolik kondisyon ve birleşik (compound) hareketler.',
    primaryMuscles: ['Tüm Kinetik Zincir', 'Kardiyovasküler Sistem'],
  },
];

@Component({
  selector: 'app-admin-disciplines',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule, DocumentDefinitionsModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-disciplines.html',
  styleUrl: './admin-disciplines.scss',
})
export class AdminDisciplines {
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly shopService = inject(AdminShopService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly route = inject(ActivatedRoute);
  private readonly gymApi = inject(GymApi);
  protected readonly docDefsService = inject(DocumentDefinitionsService);
  protected readonly showDocDefsModal = signal(false);

  protected readonly activeTab = signal<DisciplinesTab>('disciplines');
  protected readonly muscleDetails = MUSCLE_DETAILS;

  // Mail Template UI state
  protected readonly mailTemplate = signal<GymMailTemplate>(DEFAULT_MEMBER_MAIL_TEMPLATE);
  protected readonly isMailTemplateLoading = signal(false);
  protected readonly isMailTemplateSaving = signal(false);
  protected readonly mailTemplateLoaded = signal(false);
  protected readonly mailTemplateVariables = MAIL_TEMPLATE_VARIABLES;

  protected readonly mailTemplateForm: FormGroup = this.fb.group({
    enabled: [true],
    subject: ['', [Validators.required, Validators.minLength(3)]],
    heading: ['', [Validators.required, Validators.minLength(2)]],
    customMessage: [''],
    includeCredentials: [true],
    includeQrCodeInfo: [true],
    mobileAppUrl: [''],
  });

  // Reaktif Canlı Önizleme Durumu
  protected readonly previewState = signal<{
    enabled: boolean;
    subject: string;
    heading: string;
    customMessage: string;
    includeCredentials: boolean;
    includeQrCodeInfo: boolean;
    mobileAppUrl: string;
  }>({
    enabled: DEFAULT_MEMBER_MAIL_TEMPLATE.enabled,
    subject: DEFAULT_MEMBER_MAIL_TEMPLATE.subject,
    heading: DEFAULT_MEMBER_MAIL_TEMPLATE.heading,
    customMessage: DEFAULT_MEMBER_MAIL_TEMPLATE.customMessage || '',
    includeCredentials: DEFAULT_MEMBER_MAIL_TEMPLATE.includeCredentials,
    includeQrCodeInfo: DEFAULT_MEMBER_MAIL_TEMPLATE.includeQrCodeInfo,
    mobileAppUrl: DEFAULT_MEMBER_MAIL_TEMPLATE.mobileAppUrl || '',
  });

  protected readonly renderedPreviewSubject = computed(() => {
    return this.applyPreviewPlaceholders(this.previewState().subject);
  });

  protected readonly renderedPreviewHeading = computed(() => {
    return this.applyPreviewPlaceholders(this.previewState().heading);
  });

  protected readonly renderedPreviewMessage = computed(() => {
    return this.applyPreviewPlaceholders(this.previewState().customMessage);
  });

  // Live signals from Firestore
  protected readonly disciplines = toSignal(this.disciplinesService.watchDisciplines(), {
    initialValue: [] as SportsDiscipline[],
  });
  protected readonly facilities = toSignal(this.disciplinesService.watchFacilities(), {
    initialValue: [] as GymFacility[],
  });
  protected readonly equipment = toSignal(this.disciplinesService.watchEquipment(), {
    initialValue: [] as GymEquipment[],
  });
  // Stok sekmesi mağaza iznine (shop:view) bağlı; antrenörde yok, istek 403 döner.
  private readonly canSeeShop = inject(PermissionService).can('shop');
  protected readonly stockCategories = toSignal(
    this.canSeeShop ? this.shopService.watchCategories() : of([] as StockCategoryItem[]),
    { initialValue: [] as StockCategoryItem[] },
  );
  protected readonly shopProducts = toSignal(this.canSeeShop ? this.shopService.watchProducts() : of([] as ShopProduct[]), {
    initialValue: [] as ShopProduct[],
  });

  // Stock Categories UI state
  protected readonly stockCategoryModalOpen = signal(false);
  protected readonly editingStockCategoryId = signal<string | null>(null);
  protected readonly isSavingStockCategory = signal(false);

  protected readonly stockCategoryForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    key: [''],
    icon: ['📦', [Validators.required]],
    colorTag: ['indigo', [Validators.required]],
    description: [''],
  });

  // Exercises
  protected readonly exerciseLibrary = signal<Exercise[]>(DEFAULT_EXERCISE_LIBRARY);
  protected readonly selectedMuscleFilter = signal<MuscleGroup | 'all'>('all');
  protected readonly exerciseSearch = signal('');
  protected readonly exerciseModalOpen = signal(false);

  protected readonly exerciseForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    muscleGroup: ['chest' as MuscleGroup, [Validators.required]],
    equipmentName: [''],
    sets: [4, [Validators.required, Validators.min(1)]],
    reps: ['10-12', [Validators.required]],
    restSeconds: [60, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  protected readonly filteredExercises = computed(() => {
    const g = this.selectedMuscleFilter();
    const q = this.exerciseSearch().toLowerCase().trim();
    return this.exerciseLibrary().filter((ex) => {
      const matchGroup = g === 'all' || ex.muscleGroup === g;
      const matchQuery =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        (ex.equipmentName?.toLowerCase().includes(q) ?? false);
      return matchGroup && matchQuery;
    });
  });

  // Modal / Drawer states
  protected readonly disciplineModalOpen = signal(false);
  protected readonly equipmentModalOpen = signal(false);
  protected readonly facilityModalOpen = signal(false);
  protected readonly editingDisciplineId = signal<string | null>(null);
  protected readonly editingEquipmentId = signal<string | null>(null);
  protected readonly editingFacilityId = signal<string | null>(null);

  protected readonly isSaving = signal(false);
  protected readonly isSeeding = signal(false);
  protected readonly isCleaning = signal(false);

  // Forms
  protected readonly disciplineForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    code: ['fitness', [Validators.required]],
    category: ['strength', [Validators.required]],
    description: [''],
    icon: ['fitness_center', [Validators.required]],
    colorTag: ['indigo', [Validators.required]],
    requiredDocuments: [[]],
    supportedSessionTypes: [['group']],
    status: ['active'],
  });

  protected readonly equipmentForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    brandModel: [''],
    serialOrTag: [''],
    facilityId: [null],
    disciplineId: [null],
    targetMuscleGroups: [['chest']],
    quantity: [1, [Validators.required, Validators.min(1)]],
    condition: ['perfect', [Validators.required]],
    notes: [''],
  });

  protected readonly facilityForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    disciplineIds: [[]],
    capacity: [20, [Validators.required, Validators.min(1)]],
    description: [''],
    status: ['active', [Validators.required]],
  });

  protected readonly muscleGroupLabels: Record<string, string> = MUSCLE_GROUP_LABELS;
  protected readonly documentTypeLabels: Record<string, string> = DOCUMENT_TYPE_LABELS;

  protected readonly allMuscleGroups: MuscleGroup[] = [
    'chest',
    'back',
    'shoulders',
    'legs',
    'arms',
    'core',
    'fullbody',
  ];

  protected readonly allDocumentTypes: DocumentType[] = [
    'health_report',
    'parent_consent',
    'federation_license',
    'waiver_form',
  ];

  // Counters
  protected readonly totalDisciplines = computed(() => this.disciplines().length);
  protected readonly totalEquipment = computed(() =>
    this.equipment().reduce((sum, e) => sum + (e.quantity || 1), 0),
  );
  protected readonly totalFacilities = computed(() => this.facilities().length);
  protected readonly totalExercises = computed(() => this.exerciseLibrary().length);
  protected readonly totalStockCategories = computed(() => this.stockCategories().length);

  constructor() {
    const tabParam = this.route.snapshot.queryParamMap.get('tab') as DisciplinesTab;
    const url = this.route.snapshot.url.map((s) => s.path).join('/');
    if (
      tabParam &&
      ['disciplines', 'muscles', 'equipment', 'facilities', 'stock_categories', 'mail_template'].includes(tabParam)
    ) {
      this.activeTab.set(tabParam);
      if (tabParam === 'mail_template') {
        this.loadMailTemplate();
      }
    } else if (url.includes('mail-template')) {
      this.activeTab.set('mail_template');
      this.loadMailTemplate();
    } else if (url.includes('stock-categories')) {
      this.activeTab.set('stock_categories');
    } else if (url.includes('definitions')) {
      this.activeTab.set('muscles');
    }
    this.setupMailTemplateFormWatcher();
  }

  setTab(tab: DisciplinesTab): void {
    this.activeTab.set(tab);
    if (tab === 'mail_template' && !this.mailTemplateLoaded()) {
      this.loadMailTemplate();
    }
  }

  // ==========================================
  // MUSCLE & EXERCISE ACTIONS
  // ==========================================

  getExerciseCountByMuscle(group: MuscleGroup): number {
    return this.exerciseLibrary().filter((e) => e.muscleGroup === group).length;
  }

  getEquipmentCountByMuscle(group: MuscleGroup): number {
    return this.equipment().filter((e) => e.targetMuscleGroups?.includes(group)).length;
  }

  filterMuscle(group: MuscleGroup | 'all'): void {
    this.selectedMuscleFilter.set(group);
  }

  openNewExercise(group?: MuscleGroup): void {
    this.exerciseForm.reset({
      name: '',
      muscleGroup: group || (this.selectedMuscleFilter() !== 'all' ? this.selectedMuscleFilter() : 'chest'),
      equipmentName: '',
      sets: 4,
      reps: '10-12',
      restSeconds: 60,
      notes: '',
    });
    this.exerciseModalOpen.set(true);
  }

  closeExerciseModal(): void {
    this.exerciseModalOpen.set(false);
  }

  saveExercise(): void {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }
    const val = this.exerciseForm.value;
    const name = val.name?.trim() || '';
    const normName = normalizeDisciplineKey(name);

    if (this.exerciseLibrary().some((e) => normalizeDisciplineKey(e.name) === normName)) {
      this.alertService.toastError(`"${name}" isimli egzersiz kütüphanede zaten mevcut.`);
      return;
    }

    const newEx: Exercise = {
      name,
      muscleGroup: val.muscleGroup as MuscleGroup,
      equipmentName: val.equipmentName?.trim() || '',
      sets: Number(val.sets) || 3,
      reps: val.reps || 10,
      restSeconds: Number(val.restSeconds) || 60,
      notes: val.notes?.trim() || '',
    };
    this.exerciseLibrary.update((list) => [newEx, ...list]);
    this.alertService.toastSuccess('Egzersiz kütüphaneye eklendi.');
    this.closeExerciseModal();
  }

  removeExercise(exToRemove: Exercise): void {
    this.exerciseLibrary.update((list) => list.filter((e) => e !== exToRemove));
    this.snackBar.open('Egzersiz kütüphaneden kaldırıldı.', 'Tamam', { duration: 2500 });
  }

  // ==========================================
  // DISCIPLINE ACTIONS
  // ==========================================

  openNewDiscipline(): void {
    this.editingDisciplineId.set(null);
    this.disciplineForm.reset({
      name: '',
      code: 'fitness',
      category: 'strength',
      description: '',
      icon: 'fitness_center',
      colorTag: 'indigo',
      requiredDocuments: ['health_report'],
      supportedSessionTypes: ['group'],
      status: 'active',
    });
    this.disciplineModalOpen.set(true);
  }

  openEditDiscipline(d: SportsDiscipline): void {
    this.editingDisciplineId.set(d.id);
    this.disciplineForm.patchValue({
      name: d.name,
      code: d.code,
      category: d.category,
      description: d.description || '',
      icon: d.icon,
      colorTag: d.colorTag,
      requiredDocuments: d.requiredDocuments || [],
      supportedSessionTypes: d.supportedSessionTypes || [],
      status: d.status,
    });
    this.disciplineModalOpen.set(true);
  }

  toggleDocumentRequirement(docType: string): void {
    const current: string[] = this.disciplineForm.value.requiredDocuments || [];
    if (current.includes(docType)) {
      this.disciplineForm.patchValue({
        requiredDocuments: current.filter((t) => t !== docType),
      });
    } else {
      this.disciplineForm.patchValue({
        requiredDocuments: [...current, docType],
      });
    }
  }

  toggleSessionType(st: SessionFormat): void {
    const current: SessionFormat[] = this.disciplineForm.value.supportedSessionTypes || [];
    if (current.includes(st)) {
      this.disciplineForm.patchValue({
        supportedSessionTypes: current.filter((t) => t !== st),
      });
    } else {
      this.disciplineForm.patchValue({
        supportedSessionTypes: [...current, st],
      });
    }
  }

  async saveDiscipline(): Promise<void> {
    if (this.disciplineForm.invalid) {
      this.disciplineForm.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    try {
      const val = this.disciplineForm.value;
      const editId = this.editingDisciplineId();
      if (editId) {
        await this.disciplinesService.updateDiscipline(editId, val);
        this.alertService.toastSuccess('Branş bilgileri güncellendi.');
      } else {
        await this.disciplinesService.createDiscipline(val);
        this.alertService.toastSuccess('Yeni spor branşı başarıyla eklendi.');
      }
      this.disciplineModalOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'İşlem başarısız oldu.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteDiscipline(id: string): Promise<void> {
    const discipline = this.disciplines().find((d) => d.id === id);
    const name = discipline?.name ?? 'Spor Branşı';
    if (!(await this.alertService.deleteConfirm(name))) return;
    try {
      await this.disciplinesService.deleteDiscipline(id);
      this.alertService.toastSuccess('Branş silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silinemedi.');
    }
  }

  // ==========================================
  // EQUIPMENT ACTIONS
  // ==========================================

  openNewEquipment(): void {
    this.editingEquipmentId.set(null);
    this.equipmentForm.reset({
      name: '',
      brandModel: '',
      serialOrTag: '',
      facilityId: null,
      disciplineId: null,
      targetMuscleGroups: ['chest'],
      quantity: 1,
      condition: 'perfect',
      notes: '',
    });
    this.equipmentModalOpen.set(true);
  }

  openEditEquipment(eq: GymEquipment): void {
    this.editingEquipmentId.set(eq.id);
    this.equipmentForm.patchValue({
      name: eq.name,
      brandModel: eq.brandModel || '',
      serialOrTag: eq.serialOrTag || '',
      facilityId: eq.facilityId || null,
      disciplineId: eq.disciplineId || null,
      targetMuscleGroups: eq.targetMuscleGroups || ['chest'],
      quantity: eq.quantity || 1,
      condition: eq.condition || 'perfect',
      notes: eq.notes || '',
    });
    this.equipmentModalOpen.set(true);
  }

  toggleTargetMuscle(mg: MuscleGroup): void {
    const current: MuscleGroup[] = this.equipmentForm.value.targetMuscleGroups || [];
    if (current.includes(mg)) {
      this.equipmentForm.patchValue({
        targetMuscleGroups: current.filter((m) => m !== mg),
      });
    } else {
      this.equipmentForm.patchValue({
        targetMuscleGroups: [...current, mg],
      });
    }
  }

  async saveEquipment(): Promise<void> {
    if (this.equipmentForm.invalid) {
      this.equipmentForm.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    try {
      const val = this.equipmentForm.value;
      const editId = this.editingEquipmentId();
      if (editId) {
        await this.disciplinesService.updateEquipment(editId, val);
        this.alertService.toastSuccess('Cihaz bilgileri güncellendi.');
      } else {
        await this.disciplinesService.createEquipment(val);
        this.alertService.toastSuccess('Yeni cihaz/ekipman envantere eklendi.');
      }
      this.equipmentModalOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Cihaz kaydedilemedi.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteEquipment(id: string): Promise<void> {
    const eq = this.equipment().find((e) => e.id === id);
    const name = eq?.name ?? 'Cihaz Kaydı';
    if (!(await this.alertService.deleteConfirm(name))) return;
    try {
      await this.disciplinesService.deleteEquipment(id);
      this.alertService.toastSuccess('Cihaz kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme başarısız.');
    }
  }

  // ==========================================
  // FACILITY ACTIONS
  // ==========================================

  openNewFacility(): void {
    this.editingFacilityId.set(null);
    this.facilityForm.reset({
      name: '',
      disciplineIds: [],
      capacity: 20,
      description: '',
      status: 'active',
    });
    this.facilityModalOpen.set(true);
  }

  openEditFacility(f: GymFacility): void {
    this.editingFacilityId.set(f.id);
    this.facilityForm.patchValue({
      name: f.name,
      disciplineIds: f.disciplineIds || [],
      capacity: f.capacity || 20,
      description: f.description || '',
      status: f.status || 'active',
    });
    this.facilityModalOpen.set(true);
  }

  async saveFacility(): Promise<void> {
    if (this.facilityForm.invalid) {
      this.facilityForm.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    try {
      const val = this.facilityForm.value;
      const editId = this.editingFacilityId();
      if (editId) {
        await this.disciplinesService.updateFacility(editId, val);
        this.alertService.toastSuccess('Alan güncellendi.');
      } else {
        await this.disciplinesService.createFacility(val);
        this.alertService.toastSuccess('Yeni stüdyo/alan oluşturuldu.');
      }
      this.facilityModalOpen.set(false);
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'İşlem başarısız.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteFacility(id: string): Promise<void> {
    const facility = this.facilities().find((f) => f.id === id);
    const name = facility?.name ?? 'Salon Alanı';
    if (!(await this.alertService.deleteConfirm(name))) return;
    try {
      await this.disciplinesService.deleteFacility(id);
      this.alertService.toastSuccess('Alan silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme başarısız.');
    }
  }

  // ==========================================
  // SEED DEFAULTS (TEK TIKLA HAZIR ENVOİTERİ YÜKLE)
  // ==========================================

  async seedAllDefaults(): Promise<void> {
    this.isSeeding.set(true);
    try {
      const discResult = await this.disciplinesService.seedDefaultDisciplines();
      const eqResult = await this.disciplinesService.seedDefaultEquipment();
      const totalAdded = discResult.added + eqResult.added;

      if (totalAdded === 0) {
        this.alertService.toastInfo('Tüm hazır branş ve ekipmanlar zaten envanterde mevcut.');
      } else {
        this.alertService.toastSuccess(
          `${discResult.added} branş ve ${eqResult.added} ekipman başarıyla eklendi!`,
        );
      }
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Yükleme sırasında hata oluştu.');
    } finally {
      this.isSeeding.set(false);
    }
  }

  async cleanupDuplicates(): Promise<void> {
    this.isCleaning.set(true);
    try {
      const result = await this.disciplinesService.cleanupDuplicateRecords();
      const total = result.deletedDisciplines + result.deletedEquipment;
      if (total > 0) {
        this.alertService.toastSuccess(
          `${result.deletedDisciplines} mükerrer branş ve ${result.deletedEquipment} mükerrer cihaz temizlendi.`,
        );
      } else {
        this.alertService.toastInfo('Herhangi bir mükerrer kayıt bulunamadı, tüm kayıtlar tekil.');
      }
    } catch (err: any) {
      console.error(err);
      this.alertService.toastError(err?.message || 'Mükerrer temizleme işlemi başarısız oldu.');
    } finally {
      this.isCleaning.set(false);
    }
  }

  // ==========================================
  // STOK & ÜRÜN KATEGORİLERİ ACTIONS
  // ==========================================

  getProductCountByCategory(catKey?: string, catName?: string, catId?: string): number {
    const products = this.shopProducts() ?? [];
    if (!products.length) return 0;

    const normalizedKey = (catKey ?? '').trim().toLowerCase();
    const normalizedName = (catName ?? '').trim().toLowerCase();
    const normalizedId = (catId ?? '').trim().toLowerCase();

    if (!normalizedKey && !normalizedName && !normalizedId) {
      return 0;
    }

    return products.filter((p) => {
      const c = (p.category ?? '').trim().toLowerCase();
      if (!c) return false;
      return (
        (!!normalizedKey && c === normalizedKey) ||
        (!!normalizedName && c === normalizedName) ||
        (!!normalizedId && c === normalizedId)
      );
    }).length;
  }

  resolveCategoryIcon(name: string, icon?: string): string {
    return resolveCategoryEmoji(name, icon);
  }

  openNewStockCategory(): void {
    this.editingStockCategoryId.set(null);
    this.stockCategoryForm.reset({
      name: '',
      key: '',
      icon: '📦',
      colorTag: 'indigo',
      description: '',
    });
    this.stockCategoryModalOpen.set(true);
  }

  openEditStockCategory(cat: StockCategoryItem): void {
    this.editingStockCategoryId.set(cat.id ?? null);
    this.stockCategoryForm.patchValue({
      name: cat.name || '',
      key: cat.key || '',
      icon: resolveCategoryEmoji(cat.name, cat.icon),
      colorTag: cat.colorTag || 'indigo',
      description: cat.description || '',
    });
    this.stockCategoryModalOpen.set(true);
  }

  async saveStockCategory(): Promise<void> {
    if (this.stockCategoryForm.invalid) {
      this.stockCategoryForm.markAllAsTouched();
      return;
    }

    this.isSavingStockCategory.set(true);
    const val = this.stockCategoryForm.value;
    const id = this.editingStockCategoryId();

    try {
      const computedKey = (val.key?.trim() || val.name?.trim() || 'cat')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');

      const payload = {
        name: val.name?.trim(),
        key: computedKey,
        icon: resolveCategoryEmoji(val.name, val.icon),
        colorTag: val.colorTag || 'indigo',
        description: val.description?.trim() || '',
      };

      if (id) {
        await this.shopService.updateCategory(id, payload);
        this.alertService.toastSuccess('Stok kategorisi güncellendi.');
      } else {
        await this.shopService.createCategory(payload);
        this.alertService.toastSuccess('Yeni stok kategorisi eklendi.');
      }
      this.stockCategoryModalOpen.set(false);
    } catch (err: any) {
      this.alertService.toastError(err?.message || 'Kategori kaydedilemedi.');
    } finally {
      this.isSavingStockCategory.set(false);
    }
  }

  async deleteStockCategory(cat: StockCategoryItem): Promise<void> {
    if (!cat.id) return;
    const count = this.getProductCountByCategory(cat.key, cat.name, cat.id);
    if (count > 0) {
      const ok = await this.alertService.actionConfirm(
        'Kategoriyi Sil',
        `Bu kategoriye bağlı <strong>${count}</strong> adet ürün bulunmaktadır. Yine de silmek istiyor musunuz?`,
        'Evet, Sil',
        'warning',
        true,
      );
      if (!ok) return;
    } else {
      const ok = await this.alertService.deleteConfirm(cat.name);
      if (!ok) return;
    }

    try {
      await this.shopService.deleteCategory(cat.id);
      this.alertService.toastSuccess('Kategori silindi.');
    } catch {
      this.alertService.toastError('Kategori silinemedi.');
    }
  }

  async seedDefaultStockCategories(): Promise<void> {
    try {
      await this.shopService.seedDefaultCategoriesIfEmpty();
      this.alertService.toastSuccess('Varsayılan stok kategorileri oluşturuldu.');
    } catch {
      this.alertService.toastError('Kategoriler oluşturulamadı.');
    }
  }

  // ==========================================
  // MAIL TEMPLATE ACTIONS & PREVIEW
  // ==========================================

  private setupMailTemplateFormWatcher(): void {
    this.mailTemplateForm.valueChanges.subscribe((vals) => {
      this.previewState.set({
        enabled: vals.enabled !== false,
        subject: vals.subject || '',
        heading: vals.heading || '',
        customMessage: vals.customMessage || '',
        includeCredentials: vals.includeCredentials !== false,
        includeQrCodeInfo: vals.includeQrCodeInfo !== false,
        mobileAppUrl: vals.mobileAppUrl || '',
      });
    });
  }

  private applyPreviewPlaceholders(text: string): string {
    if (!text) return '';
    return text
      .replace(/{{memberName}}/g, 'Ahmet Yılmaz')
      .replace(/{{tenantName}}/g, 'Odivon GYM & Fitness')
      .replace(/{{email}}/g, 'ahmet.yilmaz@example.com')
      .replace(/{{password}}/g, 'Pass1234!')
      .replace(/{{memberNumber}}/g, 'MEM-00142')
      .replace(/{{appUrl}}/g, 'https://app.odivongym.com')
      .replace(/{{loginUrl}}/g, 'https://app.odivongym.com/login');
  }

  loadMailTemplate(): void {
    this.isMailTemplateLoading.set(true);
    this.gymApi.getMailTemplate().subscribe({
      next: (tpl) => {
        const data = tpl || DEFAULT_MEMBER_MAIL_TEMPLATE;
        this.mailTemplate.set(data);
        this.mailTemplateForm.patchValue({
          enabled: data.enabled !== false,
          subject: data.subject || DEFAULT_MEMBER_MAIL_TEMPLATE.subject,
          heading: data.heading || DEFAULT_MEMBER_MAIL_TEMPLATE.heading,
          customMessage: data.customMessage ?? DEFAULT_MEMBER_MAIL_TEMPLATE.customMessage,
          includeCredentials: data.includeCredentials !== false,
          includeQrCodeInfo: data.includeQrCodeInfo !== false,
          mobileAppUrl: data.mobileAppUrl || '',
        });
        this.previewState.set({
          enabled: data.enabled !== false,
          subject: data.subject || DEFAULT_MEMBER_MAIL_TEMPLATE.subject,
          heading: data.heading || DEFAULT_MEMBER_MAIL_TEMPLATE.heading,
          customMessage: data.customMessage ?? DEFAULT_MEMBER_MAIL_TEMPLATE.customMessage ?? '',
          includeCredentials: data.includeCredentials !== false,
          includeQrCodeInfo: data.includeQrCodeInfo !== false,
          mobileAppUrl: data.mobileAppUrl || '',
        });
        this.mailTemplateLoaded.set(true);
        this.isMailTemplateLoading.set(false);
      },
      error: (err) => {
        console.error('Mail şablonu yüklenemedi:', err);
        this.mailTemplateForm.patchValue(DEFAULT_MEMBER_MAIL_TEMPLATE);
        this.mailTemplateLoaded.set(true);
        this.isMailTemplateLoading.set(false);
      },
    });
  }

  saveMailTemplate(): void {
    if (this.mailTemplateForm.invalid) {
      this.mailTemplateForm.markAllAsTouched();
      this.alertService.toastError('Lütfen şablon için zorunlu alanları doldurunuz.');
      return;
    }

    this.isMailTemplateSaving.set(true);
    const formVal = this.mailTemplateForm.value;
    const payload: Partial<GymMailTemplate> = {
      enabled: formVal.enabled !== false,
      subject: formVal.subject?.trim(),
      heading: formVal.heading?.trim(),
      customMessage: formVal.customMessage?.trim() || '',
      includeCredentials: formVal.includeCredentials !== false,
      includeQrCodeInfo: formVal.includeQrCodeInfo !== false,
      mobileAppUrl: formVal.mobileAppUrl?.trim() || '',
    };

    this.gymApi.updateMailTemplate(payload).subscribe({
      next: (updated) => {
        this.mailTemplate.set(updated);
        this.isMailTemplateSaving.set(false);
        this.mailTemplateForm.markAsPristine();
        this.snackBar.open('Hoş Geldin e-posta şablonu başarıyla kaydedildi.', 'Kapat', {
          duration: 3500,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      },
      error: (err) => {
        this.isMailTemplateSaving.set(false);
        console.error('Mail şablonu kaydedilemedi:', err);
        this.alertService.toastError('E-posta şablonu güncellenirken bir hata oluştu.');
      },
    });
  }

  async resetMailTemplateToDefault(): Promise<void> {
    const ok = await this.alertService.actionConfirm(
      'Şablonu Sıfırla',
      'E-posta şablonunu sistem varsayılan ayarlarına döndürmek istediğinize emin misiniz? Değişiklikleri kalıcı yapmak için ardından Kaydet butonuna basmanız gerekmektedir.',
      'Varsayılana Sıfırla',
      'warning',
    );
    if (!ok) return;

    this.mailTemplateForm.patchValue({
      enabled: DEFAULT_MEMBER_MAIL_TEMPLATE.enabled,
      subject: DEFAULT_MEMBER_MAIL_TEMPLATE.subject,
      heading: DEFAULT_MEMBER_MAIL_TEMPLATE.heading,
      customMessage: DEFAULT_MEMBER_MAIL_TEMPLATE.customMessage,
      includeCredentials: DEFAULT_MEMBER_MAIL_TEMPLATE.includeCredentials,
      includeQrCodeInfo: DEFAULT_MEMBER_MAIL_TEMPLATE.includeQrCodeInfo,
      mobileAppUrl: '',
    });
    this.mailTemplateForm.markAsDirty();
    this.alertService.toastSuccess('Şablon varsayılan ayarlara sıfırlandı.');
  }

  insertVariableIntoField(field: 'subject' | 'heading' | 'customMessage', variableKey: string): void {
    const currentVal = (this.mailTemplateForm.get(field)?.value || '') as string;
    const newVal = currentVal ? `${currentVal} ${variableKey}` : variableKey;
    this.mailTemplateForm.get(field)?.setValue(newVal);
    this.mailTemplateForm.get(field)?.markAsDirty();
  }
}
