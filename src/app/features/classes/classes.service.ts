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
import { ClassSchedule, ClassBooking, CreateClassBookingInput } from '../../core/models/class-schedule.model';

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  watchSchedules(): Observable<ClassSchedule[]> {
    const tenantId = this.auth.profile()?.tenantId;

    if (!tenantId) {
      return new Observable<ClassSchedule[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'class_schedules'),
      where('tenantId', '==', tenantId),
      where('status', '==', 'active'),
      orderBy('dayOfWeek'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<ClassSchedule[]>;
  }

  watchMyBookings(): Observable<ClassBooking[]> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      return new Observable<ClassBooking[]>((subscriber) => subscriber.next([]));
    }

    const q = query(
      collection(this.firestore, 'class_bookings'),
      where('userId', '==', userId),
      where('tenantId', '==', tenantId),
      orderBy('bookingDate', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<ClassBooking[]>;
  }

  async bookClass(input: CreateClassBookingInput): Promise<string> {
    const userId = this.auth.currentUser()?.uid;
    const tenantId = this.auth.profile()?.tenantId;

    if (!userId || !tenantId) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    const docRef = await addDoc(collection(this.firestore, 'class_bookings'), {
      userId,
      tenantId,
      classScheduleId: input.classScheduleId,
      className: input.className,
      bookingDate: serverTimestamp(),
      attendanceStatus: 'booked',
      checkedInAt: null,
      notes: input.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async cancelBooking(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'class_bookings', id), {
      attendanceStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  }

  async checkIn(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'class_bookings', id), {
      attendanceStatus: 'checked-in',
      checkedInAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
