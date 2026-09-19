import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { WorkoutPlan, CreateWorkoutPlanInput } from '../../core/models/workout-plan.model';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchPlans(): Observable<WorkoutPlan[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<WorkoutPlan[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'workout_plans'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<WorkoutPlan[]>;
  }

  async createPlan(input: CreateWorkoutPlanInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'workout_plans'), {
      userId,
      tenantId,
      templateId: input.templateId || null,
      title: input.title,
      description: input.description || '',
      exercises: input.exercises,
      startDate: Timestamp.fromDate(input.startDate),
      endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
      status: 'active',
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updatePlan(id: string, input: Partial<CreateWorkoutPlanInput>): Promise<void> {
    const updateData: any = { updatedAt: serverTimestamp() };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.exercises !== undefined) updateData.exercises = input.exercises;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (input.startDate) updateData.startDate = Timestamp.fromDate(input.startDate);
    if (input.endDate) updateData.endDate = Timestamp.fromDate(input.endDate);

    await updateDoc(doc(this.firestore, 'workout_plans', id), updateData);
  }

  async deletePlan(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'workout_plans', id));
  }
}
