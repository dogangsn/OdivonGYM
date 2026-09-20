import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  ClassBooking,
  ClassSchedule,
  CreateClassScheduleInput,
  UpdateClassScheduleInput,
} from '../../core/models/class-schedule.model';

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  /** Salonun tüm dersleri (admin pasif olanları da görür — filtreyi ekran yapar). */
  watchSchedules(): Observable<ClassSchedule[]> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) return of([]);
    return collectionData(query(collection(this.firestore, 'class_schedules'), where('tenantId', '==', tenantId)), {
      idField: 'id',
    }) as Observable<ClassSchedule[]>;
  }

  watchMyBookings(): Observable<ClassBooking[]> {
    const uid = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;
    if (!uid || !tenantId) return of([]);
    return collectionData(
      query(collection(this.firestore, 'class_bookings'), where('userId', '==', uid), where('tenantId', '==', tenantId)),
      { idField: 'id' },
    ) as Observable<ClassBooking[]>;
  }

  // ---- Admin: ders programı ----
  async createSchedule(input: CreateClassScheduleInput): Promise<string> {
    const tenantId = this.auth.profile()?.tenantId;
    if (!tenantId) throw new Error('Salon bilgisi bulunamadı');
    const docRef = await addDoc(collection(this.firestore, 'class_schedules'), {
      tenantId,
      name: input.name,
      disciplineId: input.disciplineId ?? null,
      facilityId: input.facilityId ?? null,
      description: input.description ?? '',
      instructorId: input.instructorId ?? '',
      instructorName: input.instructorName,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      currentBookings: input.enrolledMemberIds?.length ?? 0,
      enrolledMemberIds: input.enrolledMemberIds ?? [],
      requiredDocuments: input.requiredDocuments ?? [],
      level: input.level ?? 'beginner',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async updateSchedule(id: string, input: UpdateClassScheduleInput): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const key of [
      'name',
      'disciplineId',
      'facilityId',
      'description',
      'instructorName',
      'dayOfWeek',
      'startTime',
      'endTime',
      'capacity',
      'enrolledMemberIds',
      'requiredDocuments',
      'level',
      'status',
    ] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    await updateDoc(doc(this.firestore, 'class_schedules', id), data);
  }

  async deleteSchedule(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'class_schedules', id));
  }

  // ---- Üye: derse kayıt / iptal ----
  /** Kontenjan sayacı ve kayıt AYNI transaction'da yazılır — dolu derse kayıt reddedilir. */
  async enroll(schedule: ClassSchedule): Promise<void> {
    const uid = this.auth.profile()?.uid;
    const tenantId = this.auth.profile()?.tenantId;
    if (!uid || !tenantId) throw new Error('Kullanıcı oturumu bulunamadı');

    const scheduleRef = doc(this.firestore, 'class_schedules', schedule.id);
    const bookingRef = doc(collection(this.firestore, 'class_bookings'));

    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(scheduleRef);
      if (!snap.exists() || snap.data()['status'] !== 'active') throw new Error('Bu ders artık açık değil.');
      const taken = (snap.data()['currentBookings'] as number) ?? 0;
      if (taken >= (snap.data()['capacity'] as number)) throw new Error('Ders dolu.');

      tx.set(bookingRef, {
        userId: uid,
        tenantId,
        classScheduleId: schedule.id,
        className: schedule.name,
        bookingDate: serverTimestamp(),
        attendanceStatus: 'booked',
        checkedInAt: null,
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(scheduleRef, { currentBookings: taken + 1, updatedAt: serverTimestamp() });
    });
  }

  async cancelBooking(booking: ClassBooking): Promise<void> {
    const scheduleRef = doc(this.firestore, 'class_schedules', booking.classScheduleId);
    const bookingRef = doc(this.firestore, 'class_bookings', booking.id);

    await runTransaction(this.firestore, async (tx) => {
      const [bookingSnap, scheduleSnap] = await Promise.all([tx.get(bookingRef), tx.get(scheduleRef)]);
      if (!bookingSnap.exists() || bookingSnap.data()['attendanceStatus'] !== 'booked') return;

      tx.update(bookingRef, { attendanceStatus: 'cancelled', updatedAt: serverTimestamp() });
      if (scheduleSnap.exists()) {
        const taken = (scheduleSnap.data()['currentBookings'] as number) ?? 0;
        tx.update(scheduleRef, { currentBookings: Math.max(0, taken - 1), updatedAt: serverTimestamp() });
      }
    });
  }
}
