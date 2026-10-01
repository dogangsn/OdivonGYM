import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

export interface OccupancyNow {
  inside: number;
  todayEntries: number;
  todayExits: number;
  /** `estimate`: gates record no exits; inside = entries in the last `stayMinutes`. */
  method: 'exits' | 'estimate';
  stayMinutes: number;
  capacity: number | null;
  day: string;
  asOf: string;
}

export interface HourlyOccupancy {
  from: string;
  to: string;
  days: number;
  totalEntries: number;
  /** [weekday 0=Pazartesi][hour] average entries */
  averages: number[][];
  hourly: number[];
  peak: { weekday: number; hour: number; average: number } | null;
  quietest: { weekday: number; hour: number; average: number } | null;
}

export interface ChurnMonth {
  month: string;
  dueCount: number;
  renewedCount: number;
  churnedCount: number;
  churnRate: number | null;
  churned: { uid: string; displayName: string; phone: string | null; packageLabel: string | null; endedAt: string }[];
}

@Injectable({ providedIn: 'root' })
export class GymReportsApi {
  private readonly api = inject(ApiClient);

  occupancyNow() {
    return this.api
      .get<OccupancyNow>('/gym/reports/occupancy/now', undefined, { skipLoading: true })
      .pipe(map((r) => r.data));
  }

  hourly(from?: string, to?: string) {
    return this.api.get<HourlyOccupancy>('/gym/reports/occupancy/hourly', { from, to }).pipe(map((r) => r.data));
  }

  churn(months = 6) {
    return this.api.get<ChurnMonth[]>('/gym/reports/churn', { months }).pipe(map((r) => r.data));
  }
}
