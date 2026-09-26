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

  queueCommand(body: unknown) {
    return this.api.post('/gym/access/commands', body).pipe(map((r) => r.data));
  }
}
