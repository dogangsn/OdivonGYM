import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, RequestOptions } from '../http/api-client';
import { AccessLog } from '../models/access-log.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly api = inject(ApiClient);

  /** Salon ayarı: turnike kayıtlarının canlı yenilenmesi (varsayılan kapalı). */
  settings() {
    return this.api
      .get<{ liveRefresh: boolean }>('/gym/access/settings', undefined, { skipLoading: true })
      .pipe(map((r) => r.data));
  }

  saveSettings(body: { liveRefresh: boolean }) {
    return this.api.put<{ liveRefresh: boolean }>('/gym/access/settings', body).pipe(map((r) => r.data));
  }

  listGates(options?: RequestOptions) {
    return this.api
      .get<unknown[]>('/gym/access/gates', { limit: 100 }, { skipLoading: true, ...options })
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  createGate(body: unknown, options?: RequestOptions) {
    return this.api.post<unknown>('/gym/access/gates', body, options).pipe(map((r) => r.data));
  }

  updateGate(id: string, body: unknown, options?: RequestOptions) {
    return this.api.patch<unknown>(`/gym/access/gates/${id}`, body, undefined, options).pipe(map((r) => r.data));
  }

  removeGate(id: string, options?: RequestOptions) {
    return this.api.delete<{ id: string }>(`/gym/access/gates/${id}`, undefined, options).pipe(map((r) => r.data));
  }

  listLogs(query?: Record<string, string | number | boolean | undefined>, options?: RequestOptions) {
    return this.api
      .get<AccessLog[]>('/gym/access/logs', { limit: 100, ...query }, { skipLoading: true, ...options })
      .pipe(map((r) => unwrapList<AccessLog>(r.data)));
  }

  createLog(body: unknown, options?: RequestOptions) {
    return this.api.post<AccessLog>('/gym/access/logs', body, options).pipe(map((r) => r.data));
  }

  scan(body: unknown, options?: RequestOptions) {
    return this.api.post('/gym/access/scan', body, { skipLoading: true, ...options }).pipe(map((r) => r.data));
  }

  listAgents(options?: RequestOptions) {
    return this.api
      .get<unknown[]>('/gym/access/agents', undefined, { skipLoading: true, ...options })
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  createPairingCode(gateIds: string[], options?: RequestOptions) {
    return this.api
      .post<{ code: string; expiresAt: string }>('/gym/access/agents/pairing-codes', { gateIds }, options)
      .pipe(map((r) => r.data));
  }

  revokeAgent(id: string, options?: RequestOptions) {
    return this.api.delete<{ id: string }>(`/gym/access/agents/${id}`, undefined, options).pipe(map((r) => r.data));
  }

  listSync(query: { gateId?: string; status?: string; limit?: number }, options?: RequestOptions) {
    return this.api
      .get<unknown[]>('/gym/access/sync', { limit: 100, ...query }, { skipLoading: true, ...options })
      .pipe(map((r) => unwrapList<unknown>(r.data)));
  }

  syncSummary(options?: RequestOptions) {
    return this.api
      .get<Record<string, unknown>>('/gym/access/sync/summary', undefined, { skipLoading: true, ...options })
      .pipe(map((r) => (r.data ?? {}) as Record<string, unknown>));
  }

  resync(gateId: string, options?: RequestOptions) {
    return this.api
      .post<unknown>('/gym/access/sync/resync', { gateId }, { skipLoading: true, ...options })
      .pipe(map((r) => r.data));
  }
}
