import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { BodyMeasurement } from '../models/body-measurement.model';
import { WaterLog } from '../models/water-log.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly api = inject(ApiClient);

  listMeasurements(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<BodyMeasurement[]>('/gym/measurements', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<BodyMeasurement>(r.data)));
  }

  createMeasurement(body: unknown) {
    return this.api.post<BodyMeasurement>('/gym/measurements', body).pipe(map((r) => r.data));
  }

  updateMeasurement(id: string, body: unknown) {
    return this.api.patch<BodyMeasurement>(`/gym/measurements/${id}`, body).pipe(map((r) => r.data));
  }

  removeMeasurement(id: string) {
    return this.api.delete<{ id: string }>(`/gym/measurements/${id}`).pipe(map((r) => r.data));
  }

  listWater(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<WaterLog[]>('/gym/water', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<WaterLog>(r.data)));
  }

  createWater(body: unknown) {
    return this.api.post<WaterLog>('/gym/water', body).pipe(map((r) => r.data));
  }

  updateWater(id: string, body: unknown) {
    return this.api.patch<WaterLog>(`/gym/water/${id}`, body).pipe(map((r) => r.data));
  }

  removeWater(id: string) {
    return this.api.delete<{ id: string }>(`/gym/water/${id}`).pipe(map((r) => r.data));
  }
}
