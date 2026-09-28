import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { AccessLog } from '../models/access-log.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly api = inject(ApiClient);

  listGates() {
    return this.api
      .get<unknown[]>('/gym/access/gates', { limit: 100 })
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  createGate(body: unknown) {
    return this.api.post<unknown>('/gym/access/gates', body).pipe(map((r) => r.data));
  }

  updateGate(id: string, body: unknown) {
    return this.api.patch<unknown>(`/gym/access/gates/${id}`, body).pipe(map((r) => r.data));
  }

  removeGate(id: string) {
    return this.api.delete<{ id: string }>(`/gym/access/gates/${id}`).pipe(map((r) => r.data));
  }

  listLogs(query?: Record<string, string | number | boolean | undefined>) {
    return this.api
      .get<AccessLog[]>('/gym/access/logs', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<AccessLog>(r.data)));
  }

  createLog(body: unknown) {
    return this.api.post<AccessLog>('/gym/access/logs', body).pipe(map((r) => r.data));
  }

  scan(body: unknown) {
    return this.api.post('/gym/access/scan', body).pipe(map((r) => r.data));
  }

  listAgents() {
    return this.api
      .get<unknown[]>('/gym/access/agents')
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  createPairingCode(gateIds: string[]) {
    return this.api
      .post<{ code: string; expiresAt: string }>('/gym/access/agents/pairing-codes', { gateIds })
      .pipe(map((r) => r.data));
  }

  revokeAgent(id: string) {
    return this.api.delete<{ id: string }>(`/gym/access/agents/${id}`).pipe(map((r) => r.data));
  }

  listSync(query: { gateId?: string; status?: string; limit?: number }) {
    return this.api
      .get<unknown[]>('/gym/access/sync', { limit: 100, ...query })
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  syncSummary() {
    return this.api
      .get<Record<string, unknown>>('/gym/access/sync/summary')
      .pipe(map((r) => (r.data ?? {}) as Record<string, unknown>));
  }

  resync(gateId: string) {
    return this.api.post<unknown>('/gym/access/sync/resync', { gateId }).pipe(map((r) => r.data));
  }
}
