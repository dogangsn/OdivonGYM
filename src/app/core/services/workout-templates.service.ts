import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, map } from 'rxjs';
import { WorkoutsApi } from '../api/workouts.api';
import { tenantReload } from '../api/unwrap';
import { AuthService } from '../auth/auth.service';
import {
  CreateWorkoutTemplateInput,
  SYSTEM_WORKOUT_TEMPLATES,
  WorkoutTemplate,
} from '../models/workout-template.model';

@Injectable({ providedIn: 'root' })
export class WorkoutTemplatesService {
  private readonly api = inject(WorkoutsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  readonly systemTemplates = signal<WorkoutTemplate[]>(SYSTEM_WORKOUT_TEMPLATES);

  watchTemplates(): Observable<WorkoutTemplate[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listTemplates()).pipe(
      map((list) => [...this.systemTemplates(), ...list]),
    );
  }

  async createTemplate(input: CreateWorkoutTemplateInput): Promise<string> {
    const profile = this.auth.profile();
    const created = await firstValueFrom(
      this.api.createTemplate({
        title: input.title.trim(),
        level: input.level,
        goal: input.goal,
        targetDaysPerWeek: Number(input.targetDaysPerWeek) || 3,
        description: input.description?.trim() || '',
        disciplineId: input.disciplineId || null,
        exercises: input.exercises || [],
        isSystemDefault: false,
        createdByTrainerId: profile?.uid,
        createdByTrainerName: profile?.displayName || 'Antrenör',
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async deleteTemplate(id: string): Promise<void> {
    if (id.startsWith('sys-tpl-')) {
      throw new Error('Sistem varsayılan şablonları silinemez.');
    }
    await firstValueFrom(this.api.removeTemplate(id));
    this.reload$.next();
  }
}
