import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

export interface ProgramRequest {
  id: string;
  userId: string;
  memberName: string;
  trainerId: string | null;
  trainerName: string | null;
  goal: string;
  daysPerWeek: number;
  notes: string;
  status: 'pending' | 'fulfilled' | 'rejected' | string;
  planId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProgramRequestsApi {
  private readonly api = inject(ApiClient);

  list() {
    return this.api.get<ProgramRequest[]>('/gym/program-requests').pipe(map((response) => unwrapList<ProgramRequest>(response.data)));
  }

  resolve(id: string, body: { status: 'fulfilled' | 'rejected'; planId?: string | null; notes?: string }) {
    return this.api.patch<ProgramRequest>(`/gym/program-requests/${id}`, body).pipe(map((response) => response.data));
  }
}
