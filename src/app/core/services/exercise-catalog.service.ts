import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, firstValueFrom, of } from 'rxjs';
import { ExercisesApi } from '../api/exercises.api';
import { tenantReload } from '../api/unwrap';
import { AuthService } from '../auth/auth.service';
import { CatalogExercise, ExerciseInput } from '../models/exercise-catalog.model';
import { DEFAULT_EXERCISE_LIBRARY, Exercise } from '../models/workout-plan.model';

/** Katalog kaydını program satırına çevirir (varsayılan set/tekrar/dinlenme ile). */
export function catalogToExercise(item: CatalogExercise): Exercise {
  return {
    exerciseId: item.id,
    name: item.name,
    muscleGroup: item.muscleGroup,
    equipmentName: item.equipmentName,
    sets: item.defaultSets,
    reps: item.defaultReps,
    restSeconds: item.defaultRestSeconds,
  };
}

/**
 * API'deki egzersiz kataloğu (sistem + salon egzersizleri). Program editörleri `presets()`
 * listesini kullanır; katalog yüklenemezse eski sabit kütüphaneye düşer.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseCatalogService {
  private readonly api = inject(ExercisesApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  readonly catalog = toSignal(
    tenantReload(this.profile$, this.reload$, () =>
      this.api.list(this.auth.profile()?.role === 'user').pipe(catchError(() => of([] as CatalogExercise[]))),
    ),
    { initialValue: [] as CatalogExercise[] },
  );

  readonly presets = computed<Exercise[]>(() => {
    const items = this.catalog();
    return items.length ? items.map(catalogToExercise) : DEFAULT_EXERCISE_LIBRARY;
  });

  async create(input: ExerciseInput): Promise<CatalogExercise> {
    const created = await firstValueFrom(this.api.create(input));
    this.reload$.next();
    return created;
  }

  async update(id: string, input: Partial<ExerciseInput>): Promise<void> {
    await firstValueFrom(this.api.update(id, input));
    this.reload$.next();
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }
}
