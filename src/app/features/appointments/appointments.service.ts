import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PtAppointment, CreatePtAppointmentInput } from '../../core/models/pt-appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchAppointments(): Observable<PtAppointment[]> {
    const userId = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<PtAppointment[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'pt_appointments'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
    );

    return collectionData(q, { idField: 'id' }) as Observable<PtAppointment[]>;
  }

  async bookAppointment(input: CreatePtAppointmentInput): Promise<string> {
    const userId = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'pt_appointments'), {
      userId,
      tenantId,
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      appointmentTime: Timestamp.fromDate(input.appointmentTime),
      duration: input.duration,
      status: 'booked',
      notes: input.notes || '',
      completedAt: null,
      cancellationReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateAppointment(id: string, input: Partial<CreatePtAppointmentInput>): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.trainerName !== undefined) data['trainerName'] = input.trainerName;
    if (input.duration !== undefined) data['duration'] = input.duration;
    if (input.notes !== undefined) data['notes'] = input.notes;
    if (input.appointmentTime) data['appointmentTime'] = Timestamp.fromDate(input.appointmentTime);
    await updateDoc(doc(this.firestore, 'pt_appointments', id), data);
  }

  async cancelAppointment(id: string, reason?: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'pt_appointments', id), {
      status: 'cancelled',
      cancellationReason: reason || '',
      updatedAt: serverTimestamp(),
    });
  }

  async completeAppointment(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'pt_appointments', id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteAppointment(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'pt_appointments', id));
  }
}
