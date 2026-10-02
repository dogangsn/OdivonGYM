import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { BodyMeasurement } from '../models/body-measurement.model';
import { ClassBooking, ClassSchedule } from '../models/class-schedule.model';
import { PtAppointment } from '../models/pt-appointment.model';
import { WalletTransaction } from '../models/wallet-transaction.model';
import { WaterLog } from '../models/water-log.model';
import { WorkoutPlan } from '../models/workout-plan.model';
import { unwrapList } from './unwrap';

/** `GET /gym/mobile/appointments` satırı. */
interface MobileAppointment {
  id: string;
  at: string;
  duration: number;
  type: string;
  trainerName: string;
  status: PtAppointment['status'];
  notes: string | null;
  cancellationReason: string | null;
}

/** `GET /gym/mobile/classes`: haftalık ders ve üyenin sıradaki seanstaki durumu. */
export interface MemberClass {
  id: string;
  name: string;
  instructorName: string;
  dayOfWeek: ClassSchedule['dayOfWeek'];
  startTime: string;
  endTime: string;
  sessionDate: string;
  capacity: number;
  taken: number;
  booked: boolean;
  bookingId: string | null;
  waitlisted: boolean;
}

/** `GET /gym/mobile/class-bookings` satırı. */
interface MobileClassBooking {
  id: string;
  classScheduleId: string;
  className: string;
  status: ClassBooking['attendanceStatus'];
  sessionDate: string | null;
  startTime: string | null;
  bookingDate: string;
}

/** `GET /gym/mobile/trainer`: üyeye atanmış antrenör (yoksa null). */
export interface MemberTrainer {
  id: string;
  displayName: string;
  title: string | null;
}

/** Üye panelinin yazdığı ölçüm alanları (`CreateMeasurementDto`). */
export type MemberMeasurementBody = Partial<
  Pick<
    BodyMeasurement,
    | 'weight' | 'height' | 'chest' | 'waist' | 'hips' | 'bicep' | 'rightBicep' | 'leftBicep'
    | 'thigh' | 'rightThigh' | 'leftThigh' | 'calf' | 'rightCalf' | 'leftCalf' | 'bodyFatPercentage' | 'notes'
  >
> & { date?: string };

export interface MemberWorkoutPlanBody {
  title?: string;
  description?: string;
  notes?: string;
  startDate?: string;
  endDate?: string | null;
  status?: WorkoutPlan['status'];
  disciplineId?: string | null;
  exercises?: unknown[];
}

/**
 * Üye ekranlarının (randevu, ders, ölçüm, su, antrenman, cüzdan) uçları: `/gym/mobile/*`.
 * Personel uçları (`/gym/appointments`, `/gym/water`…) üye hesabına 403 döner; burada kullanıcı
 * kimliği her zaman token'dan alınır. Tarihler ISO metin gelir; ekranlar `toJsDate` ile okur.
 */
@Injectable({ providedIn: 'root' })
export class MemberApi {
  private readonly api = inject(ApiClient);

  trainer() {
    return this.api.get<MemberTrainer | null>('/gym/mobile/trainer').pipe(map((r) => r.data ?? null));
  }

  appointments() {
    return this.api
      .get<MobileAppointment[]>('/gym/mobile/appointments')
      .pipe(map((r) => unwrapList<MobileAppointment>(r.data).map(toPtAppointment)));
  }

  createAppointment(body: { appointmentTime: string; duration: number; notes?: string }) {
    return this.api.post<MobileAppointment>('/gym/mobile/appointments', body).pipe(map((r) => toPtAppointment(r.data)));
  }

  rescheduleAppointment(id: string, body: { appointmentTime?: string; duration?: number; notes?: string }) {
    return this.api
      .patch<MobileAppointment>(`/gym/mobile/appointments/${encodeURIComponent(id)}`, body)
      .pipe(map((r) => toPtAppointment(r.data)));
  }

  cancelAppointment(id: string, cancellationReason?: string) {
    return this.api
      .post<MobileAppointment>(`/gym/mobile/appointments/${encodeURIComponent(id)}/cancel`, { cancellationReason })
      .pipe(map((r) => toPtAppointment(r.data)));
  }

  classes() {
    return this.api.get<MemberClass[]>('/gym/mobile/classes').pipe(map((r) => unwrapList<MemberClass>(r.data)));
  }

  classBookings() {
    return this.api
      .get<MobileClassBooking[]>('/gym/mobile/class-bookings')
      .pipe(map((r) => unwrapList<MobileClassBooking>(r.data).map(toClassBooking)));
  }

  bookClass(scheduleId: string) {
    return this.api
      .post<{ id: string; status: string; sessionDate: string }>(`/gym/mobile/classes/${encodeURIComponent(scheduleId)}/book`, {})
      .pipe(map((r) => r.data));
  }

  joinWaitlist(scheduleId: string) {
    return this.api
      .post<unknown>(`/gym/mobile/classes/${encodeURIComponent(scheduleId)}/waitlist`, {})
      .pipe(map((r) => r.data));
  }

  cancelClassBooking(bookingId: string) {
    return this.api
      .post<{ id: string }>(`/gym/mobile/class-bookings/${encodeURIComponent(bookingId)}/cancel`, {})
      .pipe(map((r) => r.data));
  }

  measurements() {
    return this.api
      .get<BodyMeasurement[]>('/gym/mobile/measurements')
      .pipe(map((r) => unwrapList<BodyMeasurement>(r.data)));
  }

  createMeasurement(body: MemberMeasurementBody) {
    return this.api.post<BodyMeasurement>('/gym/mobile/measurements', body).pipe(map((r) => r.data));
  }

  updateMeasurement(id: string, body: MemberMeasurementBody) {
    return this.api
      .patch<BodyMeasurement>(`/gym/mobile/measurements/${encodeURIComponent(id)}`, body)
      .pipe(map((r) => r.data));
  }

  removeMeasurement(id: string) {
    return this.api.delete<{ id: string }>(`/gym/mobile/measurements/${encodeURIComponent(id)}`).pipe(map((r) => r.data));
  }

  waterLogs() {
    return this.api.get<WaterLog[]>('/gym/mobile/water/logs').pipe(map((r) => unwrapList<WaterLog>(r.data)));
  }

  addWater(body: { amountMl: number; date?: string; notes?: string }) {
    return this.api.post<unknown>('/gym/mobile/water', body).pipe(map((r) => r.data));
  }

  updateWater(id: string, body: { amountMl?: number; date?: string; notes?: string }) {
    return this.api.patch<WaterLog>(`/gym/mobile/water/${encodeURIComponent(id)}`, body).pipe(map((r) => r.data));
  }

  removeWater(id: string) {
    return this.api.delete<{ id: string }>(`/gym/mobile/water/${encodeURIComponent(id)}`).pipe(map((r) => r.data));
  }

  workoutPlans() {
    return this.api.get<WorkoutPlan[]>('/gym/mobile/workout-plans').pipe(map((r) => unwrapList<WorkoutPlan>(r.data)));
  }

  createWorkoutPlan(body: MemberWorkoutPlanBody) {
    return this.api.post<WorkoutPlan>('/gym/mobile/workout-plans', body).pipe(map((r) => r.data));
  }

  updateWorkoutPlan(id: string, body: MemberWorkoutPlanBody) {
    return this.api
      .patch<WorkoutPlan>(`/gym/mobile/workout-plans/${encodeURIComponent(id)}`, body)
      .pipe(map((r) => r.data));
  }

  removeWorkoutPlan(id: string) {
    return this.api
      .delete<{ id: string }>(`/gym/mobile/workout-plans/${encodeURIComponent(id)}`)
      .pipe(map((r) => r.data));
  }

  walletTransactions() {
    return this.api
      .get<WalletTransaction[]>('/gym/mobile/wallet')
      .pipe(map((r) => unwrapList<WalletTransaction>(r.data)));
  }
}

function toPtAppointment(item: MobileAppointment): PtAppointment {
  return {
    id: item.id,
    userId: '',
    tenantId: '',
    trainerId: '',
    trainerName: item.trainerName,
    appointmentTime: item.at as never,
    duration: item.duration,
    status: item.status,
    notes: item.notes ?? '',
    cancellationReason: item.cancellationReason ?? '',
    createdAt: item.at as never,
    updatedAt: item.at as never,
  };
}

function toClassBooking(item: MobileClassBooking): ClassBooking {
  return {
    id: item.id,
    userId: '',
    tenantId: '',
    classScheduleId: item.classScheduleId,
    className: item.className,
    bookingDate: item.bookingDate as never,
    attendanceStatus: item.status,
    createdAt: item.bookingDate as never,
    updatedAt: item.bookingDate as never,
  };
}
