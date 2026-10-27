import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { CatalogExercise, ExerciseInput } from '../models/exercise-catalog.model';
import { unwrapList } from './unwrap';

/** Egzersiz kataloğu: personel `/gym/exercises`, üye `/gym/mobile/exercises`. */
@Injectable({ providedIn: 'root' })
export class ExercisesApi {
  private readonly api = inject(ApiClient);

  list(member = false) {
    return this.api
      .get<CatalogExercise[]>(member ? '/gym/mobile/exercises' : '/gym/exercises')
      .pipe(map((r) => unwrapList<CatalogExercise>(r.data)));
  }

  create(body: ExerciseInput) {
    return this.api.post<CatalogExercise>('/gym/exercises', body).pipe(map((r) => r.data));
  }

  update(id: string, body: Partial<ExerciseInput>) {
    return this.api.patch<CatalogExercise>(`/gym/exercises/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/exercises/${id}`).pipe(map((r) => r.data));
  }
}
