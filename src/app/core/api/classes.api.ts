import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { ClassBooking, ClassSchedule } from '../models/class-schedule.model';
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

  cancelBooking(scheduleId: string, bookingId: string) {
    return this.api.delete<{ id: string }>(`/gym/classes/${scheduleId}/bookings/${bookingId}`).pipe(map((r) => r.data));
  }
}
