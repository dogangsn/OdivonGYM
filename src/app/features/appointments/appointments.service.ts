import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom, of, map } from 'rxjs';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { MemberApi } from '../../core/api/member.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import { CreatePtAppointmentInput, PtAppointment } from '../../core/models/pt-appointment.model';
import { toJsDate } from '../../shared/ui/ui-utils';

function normalizeAppointment(a: PtAppointment): PtAppointment {
  const ext = (a as any).extras;
  return {
    ...a,
    memberName: a.memberName || ext?.memberName || '',
    memberPhone: a.memberPhone || ext?.memberPhone || '',
    sessionType: a.sessionType || ext?.sessionType || '',
  };
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly api = inject(AppointmentsApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();
  private readonly member = inject(MemberApi);

  /** Üye hesabı personel uçlarından 403 alır; üye kendi kayıtlarını /gym/mobile/* ile yönetir. */
  isMember(): boolean {
    return this.auth.profile()?.role === 'user';
  }

  /** Üyenin atanmış antrenörü; randevu bu antrenörle açılır. */
  memberTrainer() {
    return this.member.trainer();
  }

  watchAppointments(): Observable<PtAppointment[]> {
    return tenantReload(this.profile$, this.reload$, () => {
      const userId = this.auth.profile()?.uid;
      if (!userId) return of([]);
      if (this.isMember()) return this.member.appointments().pipe(map((list) => list.map(normalizeAppointment)));
      // Personel: antrenör kendine bağlı randevuları, resepsiyon ve yönetici salonun tümünü görür
      const role = this.auth.profile()?.role;
      return this.api
        .list(role === 'trainer' ? { trainerId: userId } : {})
        .pipe(map((list) => list.map(normalizeAppointment)));
    });
  }

  async checkTrainerConflict(
    trainerName: string,
    appointmentTime: Date,
    durationMinutes: number,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    if (!trainerName.trim()) return false;
    const list = await firstValueFrom(this.api.list());
    const newStart = appointmentTime.getTime();
    const newEnd = newStart + durationMinutes * 60 * 1000;
    const targetTrainer = trainerName.trim().toLowerCase();
    return list.some((item) => {
      if (excludeAppointmentId && item.id === excludeAppointmentId) return false;
      if (item.status === 'cancelled') return false;
      if (((item.trainerName as string) || '').trim().toLowerCase() !== targetTrainer) return false;
      const existStart = toJsDate(item.appointmentTime as never)?.getTime() ?? 0;
      const existEnd = existStart + (item.duration || 60) * 60 * 1000;
      return newStart < existEnd && newEnd > existStart;
    });
  }

  async bookAppointment(input: CreatePtAppointmentInput): Promise<string> {
    if (this.isMember()) {
      // Antrenör üyeye atanmış olandır; çakışmayı sunucu denetler (409).
      const created = await firstValueFrom(
        this.member.createAppointment({
          appointmentTime: input.appointmentTime.toISOString(),
          duration: input.duration,
          notes: input.notes || '',
        }),
      );
      this.reload$.next();
      return created.id;
    }
    const hasConflict = await this.checkTrainerConflict(input.trainerName, input.appointmentTime, input.duration);
    if (hasConflict) {
      throw new Error(
        `"${input.trainerName}" adlı antrenörün seçilen saat aralığında başka bir randevusu bulunmaktadır. Lütfen farklı bir saat seçiniz.`,
      );
    }
    const created = await firstValueFrom(
      this.api.create({
        trainerId: input.trainerId || null,
        trainerName: input.trainerName.trim(),
        appointmentTime: input.appointmentTime.toISOString(),
        duration: input.duration,
        notes: input.notes || '',
        status: 'booked',
        userId: input.userId || null,
        memberName: input.memberName || null,
        sessionType: input.sessionType || null,
        extras: {
          memberName: input.memberName || '',
          memberPhone: input.memberPhone || '',
          sessionType: input.sessionType || '',
        },
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateAppointment(id: string, input: Partial<CreatePtAppointmentInput>): Promise<void> {
    if (this.isMember()) {
      await firstValueFrom(
        this.member.rescheduleAppointment(id, {
          appointmentTime: input.appointmentTime?.toISOString(),
          duration: input.duration,
          notes: input.notes,
        }),
      );
      this.reload$.next();
      return;
    }
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
    await firstValueFrom(
      this.api.update(id, {
        ...input,
        appointmentTime: input.appointmentTime ? input.appointmentTime.toISOString() : undefined,
        trainerName: input.trainerName?.trim(),
        extras: {
          memberName: input.memberName || '',
          memberPhone: input.memberPhone || '',
          sessionType: input.sessionType || '',
        },
      }),
    );
    this.reload$.next();
  }

  async cancelAppointment(id: string, reason?: string): Promise<void> {
    await firstValueFrom(
      this.isMember()
        ? this.member.cancelAppointment(id, reason || '')
        : this.api.cancel(id, { cancellationReason: reason || '' }),
    );
    this.reload$.next();
  }

  async completeAppointment(id: string): Promise<void> {
    await firstValueFrom(this.api.complete(id));
    this.reload$.next();
  }

  async deleteAppointment(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.reload$.next();
  }
}
