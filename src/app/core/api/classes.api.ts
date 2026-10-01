import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { ClassBooking, ClassSchedule } from '../models/class-schedule.model';

/** One session of a weekly class (GET /gym/classes/:id/roster). */
export interface ClassRoster {
  scheduleId: string;
  className: string;
  sessionDate: string;
  startTime: string;
  capacity: number;
  free: number | null;
  bookings: {
    id: string;
    userId: string;
    memberName: string;
    sessionDate: string;
    attendanceStatus: 'booked' | 'checked-in' | 'no-show' | 'cancelled';
    creditReserved: boolean;
    lateCancel?: boolean;
    checkedInAt?: string | null;
  }[];
  waitlist: { id: string; position: number; userId: string; memberName: string; createdAt: string }[];
}
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class ClassesApi {
  private readonly api = inject(ApiClient);

  list(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<ClassSchedule[]>('/gym/classes', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<ClassSchedule>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<ClassSchedule>('/gym/classes', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<ClassSchedule>(`/gym/classes/${id}`, body).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/classes/${id}`).pipe(map((r) => r.data));
  }

  get(id: string) {
    return this.api.get<ClassSchedule>(`/gym/classes/${id}`).pipe(map((r) => r.data));
  }

  listBookings(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<ClassBooking[]>('/gym/classes/bookings', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<ClassBooking>(r.data)));
  }

  book(scheduleId: string, body: unknown) {
    return this.api.post<ClassBooking>(`/gym/classes/${scheduleId}/bookings`, body).pipe(map((r) => r.data));
  }

  assignMembers(scheduleId: string, enrolledMemberIds: string[]) {
    return this.api
      .patch<ClassSchedule>(`/gym/classes/${scheduleId}/members`, { enrolledMemberIds })
      .pipe(map((r) => r.data));
  }

  roster(scheduleId: string, date?: string) {
    return this.api.get<ClassRoster>(`/gym/classes/${scheduleId}/roster`, { date }).pipe(map((r) => r.data));
  }

  /** Personel: üyeyi bir seansa yazar (kontenjan ve ders hakkı sunucuda kontrol edilir). */
  bookMember(scheduleId: string, userId: string, sessionDate?: string) {
    return this.api.post<ClassBooking>(`/gym/classes/${scheduleId}/bookings`, { userId, sessionDate }).pipe(map((r) => r.data));
  }

  attendance(scheduleId: string, sessionDate: string, entries: { bookingId: string; status: 'checked-in' | 'no-show' }[]) {
    return this.api.post<unknown>(`/gym/classes/${scheduleId}/attendance`, { sessionDate, entries }).pipe(map((r) => r.data));
  }

  joinWaitlist(scheduleId: string, userId: string, sessionDate?: string) {
    return this.api.post<unknown>(`/gym/classes/${scheduleId}/waitlist`, { userId, sessionDate }).pipe(map((r) => r.data));
  }

  promoteWaitlist(scheduleId: string, sessionDate: string) {
    return this.api.post<unknown[]>(`/gym/classes/${scheduleId}/waitlist/promote`, { sessionDate }).pipe(map((r) => r.data));
  }

  cancelBooking(scheduleId: string, bookingId: string) {
    return this.api.delete<{ id: string }>(`/gym/classes/${scheduleId}/bookings/${bookingId}`).pipe(map((r) => r.data));
  }
}
