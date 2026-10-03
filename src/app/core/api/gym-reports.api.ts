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

/** `GET /gym/reports/dashboard`: izni olmayan bölüm null gelir. */
export interface DashboardSummary {
  days: string[];
  months: string[];
  checkIns: { day: string; count: number }[] | null;
  sales: { day: string; amount: number; count: number }[] | null;
  members: { active: number; expiringSoon: number; expired: number; trial: number; cancelled: number } | null;
  finance: { month: string; income: number; expense: number }[] | null;
}

export interface BranchReportRow {
  branchId: string;
  branchName: string;
  capacity: number | null;
  totalMembers: number;
  activeMembers: number;
  newMembers: number;
  revenue: number;
  expense: number;
  net: number;
  checkIns: number;
  avgDailyCheckIns: number;
  revenuePerActiveMember: number;
  revenueShare: number;
}

/** `GET /gym/reports/branches`: şube satırları toplamla tutarlıdır; `unassigned` şubesi belirsiz kayıtlar. */
export interface BranchReport {
  from: string;
  to: string;
  days: number;
  rows: BranchReportRow[];
  totals: Omit<BranchReportRow, 'branchId' | 'branchName' | 'revenueShare'>;
  monthly: { month: string; revenue: Record<string, number> }[];
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

  dashboard() {
    return this.api.get<DashboardSummary>('/gym/reports/dashboard', undefined, { skipLoading: true }).pipe(map((r) => r.data));
  }

  branches(from?: string, to?: string) {
    return this.api.get<BranchReport>('/gym/reports/branches', { from, to }).pipe(map((r) => r.data));
  }

  churn(months = 6) {
    return this.api.get<ChurnMonth[]>('/gym/reports/churn', { months }).pipe(map((r) => r.data));
  }
}
