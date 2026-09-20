import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TrainingWizardService, WizardMode } from '../../../core/services/training-wizard.service';
import { AdminMembersService } from '../../../admin/members/admin-members.service';
import { AdminDisciplinesService } from '../../../admin/disciplines/admin-disciplines.service';
import { WorkoutService } from '../../../features/workout/workout.service';
import { BranchContextService } from '../../../core/services/branch-context.service';
import { ClassesService } from '../../../features/classes/classes.service';
import { UserProfile } from '../../../core/models/user-profile.model';
import { DisciplineCategory, DisciplineCode, SportsDiscipline } from '../../../core/models/sports-discipline.model';
import { GymEquipment, GymFacility, MuscleGroup } from '../../../core/models/gym-equipment.model';
import { DEFAULT_EXERCISE_LIBRARY, Exercise } from '../../../core/models/workout-plan.model';

export interface MuscleGroupOption {
  key: MuscleGroup;
  label: string;
  icon: string;
  color: string;
}

export const MUSCLE_GROUPS: MuscleGroupOption[] = [
  { key: 'chest', label: 'Göğüs', icon: 'fitness_center', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'back', label: 'Sırt & Kanat', icon: 'accessibility_new', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'shoulders', label: 'Omuz & Trapez', icon: 'sports_gymnastics', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'legs', label: 'Bacak & Kalf', icon: 'directions_walk', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'arms', label: 'Kol (Biceps/Triceps)', icon: 'pan_tool_alt', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'core', label: 'Karın & Core', icon: 'self_improvement', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

@Component({
  selector: 'app-training-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-wizard-modal.html',
  styleUrl: './training-wizard-modal.scss',
})
export class TrainingWizardModal {
  protected readonly wizard = inject(TrainingWizardService);
  private readonly membersService = inject(AdminMembersService);
  private readonly disciplinesService = inject(AdminDisciplinesService);
  private readonly workoutService = inject(WorkoutService);
  protected readonly branchContext = inject(BranchContextService);
  private readonly classesService = inject(ClassesService);
  private readonly snackBar = inject(MatSnackBar);

  // Veri Sinyalleri
  readonly members = toSignal(this.membersService.watchMembers(), { initialValue: [] as UserProfile[] });
  readonly disciplines = toSignal(this.disciplinesService.watchDisciplines(), { initialValue: [] as SportsDiscipline[] });
  readonly facilities = toSignal(this.disciplinesService.watchFacilities(), { initialValue: [] as GymFacility[] });
  readonly equipmentList = toSignal(this.disciplinesService.watchEquipment(), { initialValue: [] as GymEquipment[] });
  readonly classSchedules = toSignal(this.classesService.watchSchedules(), { initialValue: [] });

  readonly muscleGroups = MUSCLE_GROUPS;

  // Mod & Adım Yönetimi
  readonly activeMode = signal<WizardMode>('workout');
  readonly workoutStep = signal<number>(1);
  readonly setupStep = signal<number>(1);

  // ==========================================
  // TRACK 1: SPORCU EĞİTİM & ANTRENMAN SİHİRBAZI
  // ==========================================
  readonly memberSearchTerm = signal('');
  readonly selectedMember = signal<UserProfile | null>(null);
  readonly selectedDiscipline = signal<SportsDiscipline | null>(null);
  readonly selectedMuscles = signal<MuscleGroup[]>(['chest', 'arms']);

  // Egzersiz Oluşturucu
  readonly currentPlanTitle = signal('4 Haftalık Bölgesel İtiş/Çekiş Programı');
  readonly currentPlanExercises = signal<Exercise[]>([]);
  readonly planStartDate = signal(new Date().toISOString().substring(0, 10));
  readonly planEndDate = signal(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
  );
  readonly planNotes = signal('');
  readonly savingWorkout = signal(false);

  // ==========================================
  // TRACK 2: ZİNCİRLEME SİSTEM TANIMLAMA SİHİRBAZI
  // ==========================================
  readonly savingSetup = signal(false);

  // Adım 1: Branş
  readonly newDisciplineName = signal('');
  readonly newDisciplineCategory = signal<DisciplineCategory>('strength');
  readonly newDisciplineIcon = signal('fitness_center');
  readonly newDisciplineDocs = signal<string>('Sağlık Raporu');
  readonly createdDisciplineId = signal<string | null>(null);

  // Adım 2: Tesis / Alan
  readonly newFacilityName = signal('');
  readonly newFacilityCapacity = signal(25);
  readonly createdFacilityId = signal<string | null>(null);

  // Adım 3: Cihaz / Donanım
  readonly newEquipmentName = signal('');
  readonly newEquipmentMuscle = signal<MuscleGroup>('chest');
  readonly newEquipmentQty = signal(2);
  readonly createdEquipmentId = signal<string | null>(null);

  // Adım 4: Bölgesel Egzersiz
  readonly newExerciseName = signal('');
  readonly newExerciseSets = signal(4);
  readonly newExerciseReps = signal('10-12');
  readonly newExerciseRest = signal(60);

  // Filtrelenmiş Üyeler
  readonly filteredMembers = computed(() => {
    const list = this.members();
    const term = this.memberSearchTerm().trim().toLowerCase();
    if (!term) return list.slice(0, 8);
    return list
      .filter(
        (m) =>
          m.displayName?.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.phone?.toLowerCase().includes(term),
      )
      .slice(0, 8);
  });

  // Seçilen kas gruplarına göre kütüphaneden ve salondaki cihazlardan önerilen egzersizler
  readonly suggestedExercises = computed(() => {
    const muscles = this.selectedMuscles();
    if (muscles.length === 0) return DEFAULT_EXERCISE_LIBRARY;
    return DEFAULT_EXERCISE_LIBRARY.filter((ex) => ex.muscleGroup && muscles.includes(ex.muscleGroup));
  });

  constructor() {
    // Modal açıldığında başlatma kontrolleri
    effect(() => {
      if (this.wizard.isOpen()) {
        this.activeMode.set(this.wizard.currentMode());
        const initMemberId = this.wizard.initialMemberId();
        if (initMemberId) {
          const found = this.members().find((m) => m.uid === initMemberId);
          if (found) {
            this.selectedMember.set(found);
            this.workoutStep.set(2);
          }
        }
      }
    });
  }

  setMode(mode: WizardMode): void {
    this.activeMode.set(mode);
  }

  close(): void {
    this.wizard.close();
    this.resetWorkoutForm();
    this.resetSetupForm();
  }

  // ---- WORKOUT TRACK METHODS ----
  selectMember(m: UserProfile): void {
    this.selectedMember.set(m);
    this.workoutStep.set(2);
  }

  selectDiscipline(d: SportsDiscipline): void {
    this.selectedDiscipline.set(d);
    // Branşa göre varsayılan program başlığı
    this.currentPlanTitle.set(`${d.name} — Kişiye Özel Eğitim Programı`);
    this.workoutStep.set(3);
  }

  toggleMuscle(muscle: MuscleGroup): void {
    const curr = [...this.selectedMuscles()];
    const idx = curr.indexOf(muscle);
    if (idx > -1) {
      curr.splice(idx, 1);
    } else {
      curr.push(muscle);
    }
    this.selectedMuscles.set(curr);
  }

  isMuscleSelected(muscle: MuscleGroup): boolean {
    return this.selectedMuscles().includes(muscle);
  }

  goToExercisesStep(): void {
    if (this.selectedMuscles().length === 0) {
      this.snackBar.open('Lütfen en az bir hedef kas grubu seçin.', 'Tamam', { duration: 3000 });
      return;
    }

    // Seçilen kas gruplarından varsayılan 4-5 egzersizi otomatik ekleyelim
    if (this.currentPlanExercises().length === 0) {
      const initial = this.suggestedExercises().slice(0, 5);
      this.currentPlanExercises.set(initial);
    }
    this.workoutStep.set(4);
  }

  addSuggestedExercise(ex: Exercise): void {
    const list = [...this.currentPlanExercises()];
    const exists = list.some((e) => e.name === ex.name);
    if (!exists) {
      list.push({ ...ex });
      this.currentPlanExercises.set(list);
    }
  }

  removeExercise(index: number): void {
    const list = [...this.currentPlanExercises()];
    list.splice(index, 1);
    this.currentPlanExercises.set(list);
  }

  updateExercise(index: number, patch: Partial<Exercise>): void {
    const list = [...this.currentPlanExercises()];
    list[index] = { ...list[index], ...patch };
    this.currentPlanExercises.set(list);
  }

  goToReviewStep(): void {
    if (this.currentPlanExercises().length === 0) {
      this.snackBar.open('Lütfen programa en az bir egzersiz ekleyin.', 'Tamam', { duration: 3000 });
      return;
    }
    this.workoutStep.set(5);
  }

  async saveWorkoutPlan(): Promise<void> {
    const member = this.selectedMember();
    if (!member) {
      this.snackBar.open('Üye seçilmedi.', 'Tamam', { duration: 3000 });
      return;
    }

    this.savingWorkout.set(true);
    try {
      await this.workoutService.createPlanForUser(member.uid, {
        title: this.currentPlanTitle().trim(),
        disciplineId: this.selectedDiscipline()?.id,
        exercises: this.currentPlanExercises(),
        startDate: new Date(this.planStartDate()),
        endDate: this.planEndDate() ? new Date(this.planEndDate()) : null,
        notes: this.planNotes().trim(),
      });

      this.snackBar.open(
        `✓ "${this.currentPlanTitle()}" programı ${member.displayName} üyesine başarıyla atandı!`,
        'Kapat',
        { duration: 4000 },
      );
      this.close();
    } catch (err: any) {
      this.snackBar.open(`Hata: ${err?.message || 'Kaydedilemedi'}`, 'Tamam', { duration: 4000 });
    } finally {
      this.savingWorkout.set(false);
    }
  }

  private resetWorkoutForm(): void {
    this.workoutStep.set(1);
    this.selectedMember.set(null);
    this.selectedDiscipline.set(null);
    this.selectedMuscles.set(['chest', 'arms']);
    this.currentPlanExercises.set([]);
    this.planNotes.set('');
  }

  // ---- SETUP TRACK METHODS (Zincirleme Tanımlama) ----
  async submitStep1Discipline(): Promise<void> {
    const name = this.newDisciplineName().trim();
    if (!name) {
      this.snackBar.open('Lütfen branş adını girin.', 'Tamam', { duration: 3000 });
      return;
    }

    this.savingSetup.set(true);
    try {
      const rawCode = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const validCodes: DisciplineCode[] = ['fitness', 'kickboxing', 'boxing', 'pilates', 'swimming', 'crossfit', 'yoga'];
      const code: DisciplineCode = validCodes.includes(rawCode as DisciplineCode) ? (rawCode as DisciplineCode) : 'other';
      const docs = this.newDisciplineDocs()
        ? this.newDisciplineDocs().split(',').map((d) => d.trim())
        : [];

      const id = await this.disciplinesService.createDiscipline({
        name,
        code,
        category: this.newDisciplineCategory(),
        icon: this.newDisciplineIcon(),
        colorTag: 'indigo',
        requiredDocuments: docs,
        supportedSessionTypes: ['group', 'pt'],
        status: 'active',
      });

      this.createdDisciplineId.set(id);
      this.newFacilityName.set(`${name} Antrenman Alanı`);
      this.setupStep.set(2);
      this.snackBar.open(`✓ "${name}" branşı oluşturuldu. Şimdi tesis alanını bağlayın.`, 'Tamam', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Hata: ${err?.message || 'Oluşturulamadı'}`, 'Tamam', { duration: 3000 });
    } finally {
      this.savingSetup.set(false);
    }
  }

  async submitStep2Facility(): Promise<void> {
    const name = this.newFacilityName().trim();
    if (!name) {
      this.snackBar.open('Lütfen salon alanı adını girin.', 'Tamam', { duration: 3000 });
      return;
    }

    this.savingSetup.set(true);
    try {
      const discId = this.createdDisciplineId();
      const branchId = this.branchContext.activeBranch()?.id;

      const id = await this.disciplinesService.createFacility({
        name,
        capacity: this.newFacilityCapacity(),
        branchId,
        disciplineIds: discId ? [discId] : [],
        status: 'active',
      });

      this.createdFacilityId.set(id);
      this.newEquipmentName.set(`${name} Özel Ekipmanı`);
      this.setupStep.set(3);
      this.snackBar.open(`✓ "${name}" alanı oluşturuldu. Şimdi ekipmanları tanımlayın.`, 'Tamam', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Hata: ${err?.message || 'Oluşturulamadı'}`, 'Tamam', { duration: 3000 });
    } finally {
      this.savingSetup.set(false);
    }
  }

  async submitStep3Equipment(): Promise<void> {
    const name = this.newEquipmentName().trim();
    if (!name) {
      this.snackBar.open('Lütfen cihaz / ekipman adını girin.', 'Tamam', { duration: 3000 });
      return;
    }

    this.savingSetup.set(true);
    try {
      const facilityId = this.createdFacilityId();
      const disciplineId = this.createdDisciplineId();

      const id = await this.disciplinesService.createEquipment({
        name,
        facilityId,
        disciplineId,
        targetMuscleGroups: [this.newEquipmentMuscle()],
        quantity: this.newEquipmentQty(),
        condition: 'perfect',
      });

      this.createdEquipmentId.set(id);
      this.newExerciseName.set(`${name} ile Egzersiz`);
      this.setupStep.set(4);
      this.snackBar.open(`✓ "${name}" ekipmanı eklendi. Şimdi bu cihazla yapılacak hareketi tanımlayın.`, 'Tamam', { duration: 3000 });
    } catch (err: any) {
      this.snackBar.open(`Hata: ${err?.message || 'Oluşturulamadı'}`, 'Tamam', { duration: 3000 });
    } finally {
      this.savingSetup.set(false);
    }
  }

  finishSetupChain(): void {
    this.setupStep.set(5);
    this.snackBar.open('🎉 Tebrikler! Tüm zincirleme tanımlamalar başarıyla kaydedildi.', 'Kapat', { duration: 4000 });
  }

  private resetSetupForm(): void {
    this.setupStep.set(1);
    this.newDisciplineName.set('');
    this.newFacilityName.set('');
    this.newEquipmentName.set('');
    this.newExerciseName.set('');
    this.createdDisciplineId.set(null);
    this.createdFacilityId.set(null);
    this.createdEquipmentId.set(null);
  }
}
