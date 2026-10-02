import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, map } from 'rxjs';
import { ClassesApi } from '../../core/api/classes.api';
import { MemberApi, MemberClass } from '../../core/api/member.api';
import { AuthService } from '../../core/auth/auth.service';
import { tenantReload } from '../../core/api/unwrap';
import {
  ClassBooking,
  ClassSchedule,
  CreateClassScheduleInput,
  UpdateClassScheduleInput,
} from '../../core/models/class-schedule.model';

/** Üye görünümünde ders satırı: sıradaki seanstaki rezervasyon / bekleme durumu da gelir. */
export type MemberClassSchedule = ClassSchedule & { member: MemberClass };

@Injectable({ providedIn: 'root' })
export class ClassesService {
  private readonly api = inject(ClassesApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly bookingsReload$ = new Subject<void>();
  private readonly member = inject(MemberApi);

  /** Üye hesabı personel uçlarından 403 alır; dersleri /gym/mobile/* ile görür ve rezerve eder. */
  isMember(): boolean {
    return this.auth.profile()?.role === 'user';
  }

  watchSchedules(): Observable<(ClassSchedule | MemberClassSchedule)[]> {
    return tenantReload(this.profile$, this.reload$, () =>
      this.isMember() ? this.member.classes().pipe(map((list) => list.map(toMemberSchedule))) : this.api.list(),
    );
  }

  watchMyBookings(): Observable<ClassBooking[]> {
    return tenantReload(this.profile$, this.bookingsReload$, () =>
      this.isMember() ? this.member.classBookings() : this.api.listBookings({ userId: this.auth.profile()?.uid }),
    );
  }

  /** Üye: sıradaki seansa rezervasyon (ders hakkı ve kontenjan sunucuda denetlenir). */
  async bookNextSession(scheduleId: string): Promise<void> {
    await firstValueFrom(this.member.bookClass(scheduleId));
    this.refresh();
  }

  /** Üye: dolu seans için bekleme listesi. */
  async joinWaitlist(scheduleId: string): Promise<void> {
    await firstValueFrom(this.member.joinWaitlist(scheduleId));
    this.refresh();
  }

  /** Üye: kendi rezervasyonunu iptal eder (seanstan 2 saat önceye kadar hak iade edilir). */
  async cancelMyBooking(bookingId: string): Promise<void> {
    await firstValueFrom(this.member.cancelClassBooking(bookingId));
    this.refresh();
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
    if (this.isMember()) return this.bookNextSession(schedule.id);
    await firstValueFrom(this.api.book(schedule.id, { className: schedule.name }));
    this.refresh();
  }

  async cancelBooking(booking: ClassBooking): Promise<void> {
    if (this.isMember()) return this.cancelMyBooking(booking.id);
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

function toMemberSchedule(item: MemberClass): MemberClassSchedule {
  return {
    id: item.id,
    tenantId: '',
    name: item.name,
    instructorName: item.instructorName,
    dayOfWeek: item.dayOfWeek,
    startTime: item.startTime,
    endTime: item.endTime,
    capacity: item.capacity,
    currentBookings: item.taken,
    status: 'active',
    createdAt: '' as never,
    updatedAt: '' as never,
    member: item,
  };
}
