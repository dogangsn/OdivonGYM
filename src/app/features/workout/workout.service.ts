import { Injectable, inject } from '@angular/core';
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
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CreateWorkoutPlanInput, Exercise, UpdateWorkoutPlanInput, WorkoutPlan } from '../../core/models/workout-plan.model';

/** Firestore `undefined` alan değerini reddeder — boş alanları çıkar. */
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
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchPlans(): Observable<WorkoutPlan[]> {
    const uid = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;
    if (!uid || !tenantId) return of([]);

    return (collectionData(
      query(collection(this.firestore, 'workout_plans'), where('userId', '==', uid), where('tenantId', '==', tenantId)),
      { idField: 'id' },
    ) as Observable<WorkoutPlan[]>).pipe(
      map((plans) =>
        [...plans].sort(
          (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
        ),
      ),
    );
  }

  async createPlan(input: CreateWorkoutPlanInput): Promise<string> {
    const uid = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;
    if (!uid || !tenantId) throw new Error('Kullanıcı oturumu bulunamadı');

    const docRef = await addDoc(collection(this.firestore, 'workout_plans'), {
      userId: uid,
      tenantId,
      templateId: input.templateId ?? null,
      title: input.title,
      description: input.description ?? '',
      exercises: cleanExercises(input.exercises),
      startDate: Timestamp.fromDate(input.startDate),
      endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
      status: 'active',
      notes: input.notes ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async createPlanForUser(targetUserId: string, input: CreateWorkoutPlanInput): Promise<string> {
    const trainerProfile = this.auth.profile();
    const tenantId = trainerProfile?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');

    const docRef = await addDoc(collection(this.firestore, 'workout_plans'), {
      userId: targetUserId,
      tenantId,
      trainerId: trainerProfile?.uid ?? null,
      trainerName: trainerProfile?.displayName ?? 'Salon Antrenörü',
      disciplineId: input.disciplineId ?? null,
      templateId: input.templateId ?? null,
      title: input.title,
      description: input.description ?? '',
      exercises: cleanExercises(input.exercises),
      startDate: Timestamp.fromDate(input.startDate),
      endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
      status: 'active',
      notes: input.notes ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updatePlan(id: string, input: UpdateWorkoutPlanInput): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.title !== undefined) data['title'] = input.title;
    if (input.description !== undefined) data['description'] = input.description;
    if (input.exercises !== undefined) data['exercises'] = cleanExercises(input.exercises);
    if (input.notes !== undefined) data['notes'] = input.notes;
    if (input.status !== undefined) data['status'] = input.status;
    if (input.startDate) data['startDate'] = Timestamp.fromDate(input.startDate);
    if (input.endDate !== undefined) data['endDate'] = input.endDate ? Timestamp.fromDate(input.endDate) : null;

    await updateDoc(doc(this.firestore, 'workout_plans', id), data);
  }

  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'workout_plans', id));
  }
}
