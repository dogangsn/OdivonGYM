import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDocs,
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

  /**
   * Seçilen antrenörün belirtilen tarih ve saat aralığında başka aktif randevusu olup olmadığını denetler.
   */
  async checkTrainerConflict(
    trainerName: string,
    appointmentTime: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId || !trainerName.trim()) return false;

    const q = query(
      collection(this.firestore, 'pt_appointments'),
      where('tenantId', '==', tenantId),
      where('status', '==', 'booked'),
    );

    const snapshot = await getDocs(q);
    const newStart = appointmentTime.getTime();
    const newEnd = newStart + durationMinutes * 60 * 1000;
    const targetTrainer = trainerName.trim().toLowerCase();

    for (const d of snapshot.docs) {
      if (excludeAppointmentId && d.id === excludeAppointmentId) continue;
      const data = d.data();
      const existingTrainer = ((data['trainerName'] as string) || '').trim().toLowerCase();
      if (existingTrainer !== targetTrainer) continue;

      const existTs = data['appointmentTime'] as Timestamp | undefined;
      if (!existTs) continue;
      const existStart = existTs.toMillis();
      const existDuration = (data['duration'] as number) || 60;
      const existEnd = existStart + existDuration * 60 * 1000;

      // Zaman çakışması kontrolü
      if (newStart < existEnd && newEnd > existStart) {
        return true;
      }
    }
    return false;
  }

  async bookAppointment(input: CreatePtAppointmentInput): Promise<string> {
    const user = this.auth.profile();
    const userId = user?.uid;
    const tenantId = user?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    // Antrenör takvim çakışması denetimi
    const hasConflict = await this.checkTrainerConflict(
      input.trainerName,
      input.appointmentTime,
      input.duration,
    );
    if (hasConflict) {
      throw new Error(
        `"${input.trainerName}" adlı antrenörün seçilen saat aralığında başka bir randevusu bulunmaktadır. Lütfen farklı bir saat seçiniz.`,
      );
    }

    const docRef = await addDoc(collection(this.firestore, 'pt_appointments'), {
      userId,
      tenantId,
      userName: user.displayName || 'Üye',
      trainerId: input.trainerId || null,
      trainerName: input.trainerName.trim(),
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
    if (input.trainerName && input.appointmentTime && input.duration) {
      const hasConflict = await this.checkTrainerConflict(
        input.trainerName,
        input.appointmentTime,
        input.duration,
        id,
      );
      if (hasConflict) {
        throw new Error(
          `"${input.trainerName}" adlı antrenörün seçilen saat aralığında başka bir randevusu bulunmaktadır. Lütfen farklı bir saat seçiniz.`,
        );
      }
    }

    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.trainerName !== undefined) data['trainerName'] = input.trainerName.trim();
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
