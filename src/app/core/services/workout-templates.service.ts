import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  CreateWorkoutTemplateInput,
  SYSTEM_WORKOUT_TEMPLATES,
  WorkoutTemplate,
} from '../models/workout-template.model';

@Injectable({ providedIn: 'root' })
export class WorkoutTemplatesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);

  // Local fallback templates for offline / instant demo
  readonly systemTemplates = signal<WorkoutTemplate[]>(SYSTEM_WORKOUT_TEMPLATES);

  /**
   * Hem salonun kendi oluşturduğu antrenman şablonlarını hem de
   * sistemle hazır gelen profesyonel şablonları birleşik olarak dinler.
   */
  watchTemplates(): Observable<WorkoutTemplate[]> {
    return this.profile$.pipe(
      switchMap((profile) => {
        const tenantId = profile?.tenantId;
        if (!tenantId) {
          return of(this.systemTemplates());
        }

        const q = query(
          collection(this.firestore, 'workout_templates'),
          where('tenantId', '==', tenantId),
        );

        return (collectionData(q, { idField: 'id' }) as Observable<WorkoutTemplate[]>).pipe(
          catchError(() => of([] as WorkoutTemplate[])),
          map((tenantList) => {
            const sortedTenant = [...tenantList].sort((a, b) => {
              const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt?.toMillis?.() ?? 0;
              const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt?.toMillis?.() ?? 0;
              return bTime - aTime;
            });
            // Salonun özel şablonları en üstte, sistem şablonları altta listelenir
            return [...sortedTenant, ...this.systemTemplates()];
          }),
        );
      }),
    );
  }

  /**
   * Antrenörün veya yöneticinin salona özel yeni bir antrenman şablonu kaydetmesi
   */
  async createTemplate(input: CreateWorkoutTemplateInput): Promise<string> {
    const profile = this.auth.profile();
    const tenantId = profile?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı.');

    const docRef = await addDoc(collection(this.firestore, 'workout_templates'), {
      tenantId,
      title: input.title.trim(),
      level: input.level,
      goal: input.goal,
      targetDaysPerWeek: Number(input.targetDaysPerWeek) || 3,
      description: input.description?.trim() || '',
      disciplineId: input.disciplineId || null,
      exercises: input.exercises || [],
      isSystemDefault: false,
      createdByTrainerId: profile.uid,
      createdByTrainerName: profile.displayName || 'Antrenör',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Antrenman şablonunu siler (Sadece salona ait olanlar silinebilir, sistem şablonları silinemez)
   */
  async deleteTemplate(id: string): Promise<void> {
    if (id.startsWith('sys-tpl-')) {
      throw new Error('Sistem varsayılan şablonları silinemez.');
    }
    await deleteDoc(doc(this.firestore, 'workout_templates', id));
  }
}
