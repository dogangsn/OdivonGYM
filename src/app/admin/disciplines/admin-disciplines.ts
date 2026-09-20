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
import { AdminDisciplinesService } from './admin-disciplines.service';
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
import { toSignal } from '@angular/core/rxjs-interop';

export type DisciplinesTab = 'disciplines' | 'equipment' | 'facilities';

@Component({
  selector: 'app-admin-disciplines',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-disciplines.html',
  styleUrl: './admin-disciplines.scss',
})
export class AdminDisciplines {
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly activeTab = signal<DisciplinesTab>('disciplines');

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

  // Modal / Drawer states
  protected readonly disciplineModalOpen = signal(false);
  protected readonly equipmentModalOpen = signal(false);
  protected readonly facilityModalOpen = signal(false);
  protected readonly editingDisciplineId = signal<string | null>(null);
  protected readonly editingEquipmentId = signal<string | null>(null);
  protected readonly editingFacilityId = signal<string | null>(null);

  protected readonly isSaving = signal(false);
  protected readonly isSeeding = signal(false);

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

  setTab(tab: DisciplinesTab): void {
    this.activeTab.set(tab);
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

  toggleDocumentRequirement(docType: DocumentType): void {
    const current: DocumentType[] = this.disciplineForm.value.requiredDocuments || [];
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
        this.snackBar.open('Branş bilgileri güncellendi.', 'Tamam', { duration: 3000 });
      } else {
        await this.disciplinesService.createDiscipline(val);
        this.snackBar.open('Yeni spor branşı başarıyla eklendi.', 'Tamam', { duration: 3000 });
      }
      this.disciplineModalOpen.set(false);
    } catch (err) {
      console.error(err);
      this.snackBar.open('İşlem başarısız oldu.', 'Kapat', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteDiscipline(id: string): Promise<void> {
    if (!confirm('Bu spor branşını silmek istediğinize emin misiniz?')) return;
    try {
      await this.disciplinesService.deleteDiscipline(id);
      this.snackBar.open('Branş silindi.', 'Tamam', { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Silinemedi.', 'Kapat', { duration: 3000 });
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
        this.snackBar.open('Cihaz bilgileri güncellendi.', 'Tamam', { duration: 3000 });
      } else {
        await this.disciplinesService.createEquipment(val);
        this.snackBar.open('Yeni cihaz/ekipman envantere eklendi.', 'Tamam', { duration: 3000 });
      }
      this.equipmentModalOpen.set(false);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Cihaz kaydedilemedi.', 'Kapat', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteEquipment(id: string): Promise<void> {
    if (!confirm('Bu cihaz kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await this.disciplinesService.deleteEquipment(id);
      this.snackBar.open('Cihaz kaydı silindi.', 'Tamam', { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Silme başarısız.', 'Kapat', { duration: 3000 });
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
        this.snackBar.open('Alan güncellendi.', 'Tamam', { duration: 3000 });
      } else {
        await this.disciplinesService.createFacility(val);
        this.snackBar.open('Yeni stüdyo/alan oluşturuldu.', 'Tamam', { duration: 3000 });
      }
      this.facilityModalOpen.set(false);
    } catch (err) {
      console.error(err);
      this.snackBar.open('İşlem başarısız.', 'Kapat', { duration: 3000 });
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteFacility(id: string): Promise<void> {
    if (!confirm('Bu salon alanını silmek istediğinize emin misiniz?')) return;
    try {
      await this.disciplinesService.deleteFacility(id);
      this.snackBar.open('Alan silindi.', 'Tamam', { duration: 3000 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Silme başarısız.', 'Kapat', { duration: 3000 });
    }
  }

  // ==========================================
  // SEED DEFAULTS (TEK TIKLA HAZIR ENVOİTERİ YÜKLE)
  // ==========================================

  async seedAllDefaults(): Promise<void> {
    this.isSeeding.set(true);
    try {
      await this.disciplinesService.seedDefaultDisciplines();
      await this.disciplinesService.seedDefaultEquipment();
      this.snackBar.open('Varsayılan branş ve ekipmanlar başarıyla yüklendi!', 'Tamam', {
        duration: 3500,
      });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Yükleme sırasında hata oluştu.', 'Kapat', { duration: 3000 });
    } finally {
      this.isSeeding.set(false);
    }
  }
}
