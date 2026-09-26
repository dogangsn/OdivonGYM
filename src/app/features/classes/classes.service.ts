import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { ClassesApi } from '../../core/api/classes.api';
import { AuthService } from '../../core/auth/auth.service';
import { tenantReload } from '../../core/api/unwrap';
import {
  ClassBooking,
  ClassSchedule,
  CreateClassScheduleInput,
  UpdateClassScheduleInput,
} from '../../core/models/class-schedule.model';

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly api = inject(ClassesApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly bookingsReload$ = new Subject<void>();

  watchSchedules(): Observable<ClassSchedule[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.list());
  }

  watchMyBookings(): Observable<ClassBooking[]> {
    return tenantReload(this.profile$, this.bookingsReload$, () =>
      this.api.listBookings({ userId: this.auth.profile()?.uid }),
    );
  }

  private refresh(): void {
    this.reload$.next();
    this.bookingsReload$.next();
  }

  async createSchedule(input: CreateClassScheduleInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.create({
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
        enrolledMemberIds: input.enrolledMemberIds ?? [],
        requiredDocuments: input.requiredDocuments ?? [],
        level: input.level ?? 'beginner',
        status: 'active',
      }),
    );
    this.refresh();
    return created.id;
  }

  async updateSchedule(id: string, input: UpdateClassScheduleInput): Promise<void> {
    await firstValueFrom(this.api.update(id, input));
    this.refresh();
  }

  async deleteSchedule(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.refresh();
  }

  async enroll(schedule: ClassSchedule): Promise<void> {
    await firstValueFrom(this.api.book(schedule.id, { className: schedule.name }));
    this.refresh();
  }

  async cancelBooking(booking: ClassBooking): Promise<void> {
    await firstValueFrom(this.api.cancelBooking(booking.classScheduleId, booking.id));
    this.refresh();
  }

  async assignMemberToClass(scheduleId: string, memberId: string): Promise<void> {
    const schedule = await firstValueFrom(this.api.get(scheduleId));
    const current = schedule.enrolledMemberIds ?? [];
    if (current.includes(memberId)) {
      throw new Error('Üye zaten bu derse atanmış.');
    }
    if (current.length >= (schedule.capacity || 20)) {
      throw new Error('Ders kontenjanı dolmuştur.');
    }
    await firstValueFrom(this.api.assignMembers(scheduleId, [...current, memberId]));
    this.refresh();
  }

  async removeMemberFromClass(scheduleId: string, memberId: string): Promise<void> {
    const schedule = await firstValueFrom(this.api.get(scheduleId));
    const updated = (schedule.enrolledMemberIds ?? []).filter((id) => id !== memberId);
    await firstValueFrom(this.api.assignMembers(scheduleId, updated));
    this.refresh();
  }
}
