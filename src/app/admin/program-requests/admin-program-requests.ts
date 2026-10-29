import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ProgramRequest, ProgramRequestsApi } from '../../core/api/program-requests.api';
import { AlertService } from '../../core/services/alert.service';
import { Exercise } from '../../core/models/workout-plan.model';
import { WorkoutDayState } from '../../core/models/workout-day-state';
import { WorkoutService } from '../../features/workout/workout.service';
import { ExercisePicker } from '../../shared/components/exercise-picker/exercise-picker';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { WorkoutDayTabs } from '../../shared/components/workout-day-tabs/workout-day-tabs';
import { toAppError } from '../../shared/models/app-error.model';
import { formatDateTime } from '../../shared/ui/ui-utils';

export type ProgramRequestFilter = 'all' | 'pending' | 'fulfilled' | 'rejected';

@Component({
  selector: 'app-admin-program-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PageHeader, ExercisePicker, WorkoutDayTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-program-requests.html',
})
export class AdminProgramRequests {
  private readonly api = inject(ProgramRequestsApi);
  private readonly workouts = inject(WorkoutService);
  private readonly alerts = inject(AlertService);

  protected readonly formatDate = formatDateTime;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly requests = signal<ProgramRequest[]>([]);
  protected readonly selected = signal<ProgramRequest | null>(null);

  // Filters & Search
  protected readonly statusFilter = signal<ProgramRequestFilter>('all');
  protected readonly searchQuery = signal('');

  // Program Builder Form State
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly rejectNote = signal('');
  protected readonly exercises = signal<Exercise[]>([]);
  protected readonly days = new WorkoutDayState(
    () => this.exercises().map((exercise) => exercise.dayName),
    (map) =>
      this.exercises.update((list) =>
        list.flatMap((item) => {
          const dayName = map(item.dayName);
          return dayName === null ? [] : [{ ...item, dayName }];
        }),
      ),
  );

  // KPI Metrics
  protected readonly totalCount = computed(() => this.requests().length);
  protected readonly pendingCount = computed(
    () => this.requests().filter((r) => r.status === 'pending').length,
  );
  protected readonly fulfilledCount = computed(
    () => this.requests().filter((r) => r.status === 'fulfilled').length,
  );
  protected readonly rejectedCount = computed(
    () => this.requests().filter((r) => r.status === 'rejected').length,
  );
  protected readonly completionRate = computed(() => {
    const total = this.totalCount();
    if (!total) return 0;
    return Math.round((this.fulfilledCount() / total) * 100);
  });

  protected readonly filteredRequests = computed(() => {
    const status = this.statusFilter();
    const q = this.searchQuery().trim().toLocaleLowerCase('tr');
    return this.requests().filter((req) => {
      if (status !== 'all' && req.status !== status) return false;
      if (!q) return true;
      return (
        (req.memberName ?? '').toLocaleLowerCase('tr').includes(q) ||
        (req.goal ?? '').toLocaleLowerCase('tr').includes(q) ||
        (req.trainerName ?? '').toLocaleLowerCase('tr').includes(q) ||
        (req.notes ?? '').toLocaleLowerCase('tr').includes(q)
      );
    });
  });

  protected readonly activeDayExercisesCount = computed(
    () => this.exercises().filter((ex) => this.days.isActive(ex.dayName)).length,
  );

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

  protected clearFilters(): void {
    this.statusFilter.set('all');
    this.searchQuery.set('');
  }

  protected open(request: ProgramRequest): void {
    this.selected.set(request);
    this.title.set(`${request.memberName} Antrenman Programı`);
    this.description.set(request.goal);
    this.rejectNote.set('');
    this.exercises.set([]);
    this.days.reset();
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected addPreset(preset: Exercise): void {
    this.exercises.update((list) => [...list, { ...preset, dayName: this.days.label() }]);
  }

  protected addBlank(): void {
    this.exercises.update((list) => [
      ...list,
      { name: '', dayName: this.days.label(), sets: 3, reps: 10, restSeconds: 60 },
    ]);
  }

  protected updateExercise(index: number, patch: Partial<Exercise>): void {
    this.exercises.update((list) =>
      list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
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
      await firstValueFrom(
        this.api.resolve(request.id, { status: 'rejected', notes: this.rejectNote().trim() }),
      );
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
    if (status === 'fulfilled') return 'Program Hazır';
    if (status === 'rejected') return 'Karşılanamadı';
    return status;
  }

  protected statusBadgeClass(status: string): string {
    if (status === 'pending') return 'badge-amber';
    if (status === 'fulfilled') return 'badge-emerald';
    if (status === 'rejected') return 'badge-rose';
    return 'badge-slate';
  }
}
