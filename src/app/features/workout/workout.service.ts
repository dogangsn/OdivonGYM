import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { WorkoutsApi } from '../../core/api/workouts.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreateWorkoutPlanInput, Exercise, UpdateWorkoutPlanInput, WorkoutPlan } from '../../core/models/workout-plan.model';

function cleanExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map((e) => {
    const out: Exercise = { name: e.name };
    if (e.id) out.id = e.id;
    if (e.muscleGroup) out.muscleGroup = e.muscleGroup;
    if (e.equipmentName) out.equipmentName = e.equipmentName;
    if (e.dayName) out.dayName = e.dayName;
    if (e.sets !== undefined) out.sets = e.sets;
    if (e.reps !== undefined) out.reps = e.reps;
    if (e.weight !== undefined) out.weight = e.weight;
    if (e.restSeconds !== undefined) out.restSeconds = e.restSeconds;
    if (e.duration !== undefined) out.duration = e.duration;
    if (e.notes) out.notes = e.notes;
    return out;
  });
}

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly api = inject(WorkoutsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchPlans(): Observable<WorkoutPlan[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const uid = this.auth.profile()?.uid;
      if (!uid) return of([]);
      return this.api.list({ userId: uid });
    });
  }

  async createPlan(input: CreateWorkoutPlanInput): Promise<string> {
    const created = await firstValueFrom(this.api.create(this.toBody(input)));
    this.reload$.next();
    return created.id;
  }

  async createPlanForUser(targetUserId: string, input: CreateWorkoutPlanInput): Promise<string> {
    const trainer = this.auth.profile();
    const created = await firstValueFrom(
      this.api.create({
        ...this.toBody(input),
        userId: targetUserId,
        trainerId: trainer?.uid ?? null,
        trainerName: trainer?.displayName ?? 'Salon Antrenörü',
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updatePlan(id: string, input: UpdateWorkoutPlanInput): Promise<void> {
    await firstValueFrom(
      this.api.update(id, {
        ...input,
        exercises: input.exercises ? cleanExercises(input.exercises) : undefined,
        startDate: input.startDate ? input.startDate.toISOString() : undefined,
        endDate: input.endDate ? input.endDate.toISOString() : input.endDate === null ? null : undefined,
      }),
    );
    this.reload$.next();
  }

  async deletePlan(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }

  private toBody(input: CreateWorkoutPlanInput) {
    return {
      templateId: input.templateId ?? null,
      title: input.title,
      description: input.description ?? '',
      exercises: cleanExercises(input.exercises),
      startDate: input.startDate.toISOString(),
      endDate: input.endDate ? input.endDate.toISOString() : null,
      status: 'active',
      notes: input.notes ?? '',
      disciplineId: input.disciplineId ?? null,
    };
  }
}
