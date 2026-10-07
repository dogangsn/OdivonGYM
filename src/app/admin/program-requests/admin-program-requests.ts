import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ProgramRequest, ProgramRequestsApi } from '../../core/api/program-requests.api';
import { AlertService } from '../../core/services/alert.service';
import { DEFAULT_EXERCISE_LIBRARY, Exercise } from '../../core/models/workout-plan.model';
import { workoutDayIndex, workoutDayLabel, workoutDayNumbers } from '../../core/models/workout-day';
import { WorkoutService } from '../../features/workout/workout.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { toAppError } from '../../shared/models/app-error.model';

@Component({
  selector: 'app-admin-program-requests',
  standalone: true,
  imports: [FormsModule, MatIconModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-program-requests.html',
})
export class AdminProgramRequests {
  private readonly api = inject(ProgramRequestsApi);
  private readonly workouts = inject(WorkoutService);
  private readonly alerts = inject(AlertService);

  protected readonly presets = DEFAULT_EXERCISE_LIBRARY;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly requests = signal<ProgramRequest[]>([]);
  protected readonly selected = signal<ProgramRequest | null>(null);
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly rejectNote = signal('');
  protected readonly exercises = signal<Exercise[]>([]);
  protected readonly activeDay = signal(1);
  protected readonly extraDays = signal(1);

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.requests.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      const appError = toAppError(error);
      await this.alerts.error('Talepler yüklenemedi', appError.message);
    } finally {
      this.loading.set(false);
    }
  }

  protected open(request: ProgramRequest): void {
    this.selected.set(request);
    this.title.set(`${request.memberName} programı`);
    this.description.set(request.goal);
    this.rejectNote.set('');
    this.exercises.set([]);
    this.activeDay.set(1);
    this.extraDays.set(1);
  }

  protected dayNumbers(): number[] {
    return workoutDayNumbers(
      this.exercises().map((exercise) => exercise.dayName),
      Math.max(this.extraDays(), this.activeDay()),
    );
  }

  protected addDay(): void {
    const next = this.dayNumbers().length + 1;
    this.extraDays.set(next);
    this.activeDay.set(next);
  }

  protected onDay(exercise: Exercise): boolean {
    return workoutDayIndex(exercise.dayName) === this.activeDay();
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected addPreset(name: string): void {
    const preset = this.presets.find((item) => item.name === name);
    if (!preset) return;
    this.exercises.update((list) => [...list, { ...preset, dayName: workoutDayLabel(this.activeDay()) }]);
  }

  protected addBlank(): void {
    this.exercises.update((list) => [
      ...list,
      { name: '', dayName: workoutDayLabel(this.activeDay()), sets: 3, reps: 10, restSeconds: 60 },
    ]);
  }

  protected updateExercise(index: number, patch: Partial<Exercise>): void {
    this.exercises.update((list) => list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  protected removeExercise(index: number): void {
    this.exercises.update((list) => list.filter((_, itemIndex) => itemIndex !== index));
  }

  protected async assign(): Promise<void> {
    const request = this.selected();
    if (!request || request.status !== 'pending') return;
    const title = this.title().trim();
    const exercises = this.exercises().filter((item) => item.name.trim());
    if (!title || exercises.length === 0) {
      await this.alerts.error('Eksik bilgi', 'Program adı ve en az bir hareket gerekli.');
      return;
    }
    this.saving.set(true);
    try {
      await this.workouts.createPlanForUser(request.userId, {
        title,
        description: this.description().trim(),
        exercises,
        startDate: new Date(),
        notes: request.notes,
      });
      await this.alerts.success('Program atandı', 'Talep kapatıldı ve üyeye bildirildi.');
      this.close();
      await this.reload();
    } catch (error) {
      const appError = toAppError(error);
      await this.alerts.error('Atama başarısız', appError.message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async reject(): Promise<void> {
    const request = this.selected();
    if (!request || request.status !== 'pending') return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.resolve(request.id, { status: 'rejected', notes: this.rejectNote().trim() }));
      await this.alerts.success('Talep kapatıldı');
      this.close();
      await this.reload();
    } catch (error) {
      const appError = toAppError(error);
      await this.alerts.error('İşlem başarısız', appError.message);
    } finally {
      this.saving.set(false);
    }
  }

  protected statusLabel(status: string): string {
    if (status === 'pending') return 'Bekliyor';
    if (status === 'fulfilled') return 'Program hazır';
    if (status === 'rejected') return 'Karşılanamadı';
    return status;
  }
}
