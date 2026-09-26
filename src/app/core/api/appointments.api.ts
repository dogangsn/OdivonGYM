import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { PtAppointment } from '../models/pt-appointment.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly api = inject(ApiClient);

  list(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<PtAppointment[]>('/gym/appointments', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<PtAppointment>(r.data)));
  }

  create(body: unknown) {
    return this.api.post<PtAppointment>('/gym/appointments', body).pipe(map((r) => r.data));
  }

  update(id: string, body: unknown) {
    return this.api.patch<PtAppointment>(`/gym/appointments/${id}`, body).pipe(map((r) => r.data));
  }

  complete(id: string) {
    return this.api.post<PtAppointment>(`/gym/appointments/${id}/complete`, {}).pipe(map((r) => r.data));
  }

  cancel(id: string, body?: unknown) {
    return this.api.post<PtAppointment>(`/gym/appointments/${id}/cancel`, body ?? {}).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<{ id: string }>(`/gym/appointments/${id}`).pipe(map((r) => r.data));
  }
}
