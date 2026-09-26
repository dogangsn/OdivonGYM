import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { WorkoutPlan } from '../models/workout-plan.model';
import { WorkoutTemplate } from '../models/workout-template.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class WorkoutsApi {
  private readonly api = inject(ApiClient);

  list(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<WorkoutPlan[]>('/gym/workouts', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<WorkoutPlan>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<WorkoutPlan>('/gym/workouts', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<WorkoutPlan>(`/gym/workouts/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/workouts/${id}`).pipe(map((r) => r.data));
  }

  listTemplates(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<WorkoutTemplate[]>('/gym/workout-templates', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<WorkoutTemplate>(r.data)));
  }

  createTemplate(body: unknown) {
    return this.api.post<WorkoutTemplate>('/gym/workout-templates', body).pipe(map((r) => r.data));
  }

  updateTemplate(id: string, body: unknown) {
    return this.api.patch<WorkoutTemplate>(`/gym/workout-templates/${id}`, body).pipe(map((r) => r.data));
  }

  removeTemplate(id: string) {
    return this.api.delete<{ id: string }>(`/gym/workout-templates/${id}`).pipe(map((r) => r.data));
  }
}
