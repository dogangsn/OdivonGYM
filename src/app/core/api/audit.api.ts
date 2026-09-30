import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { unwrapList } from './unwrap';

export interface GymAuditLog {
  id: string;
  createdAt: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  actorType: 'staff' | 'member';
  method: string;
  route: string;
  entity: string;
  moduleLabel: string;
  verb: 'create' | 'update' | 'delete' | 'action';
  label: string;
  entityId: string | null;
  targetUserId: string | null;
  request: unknown;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  result: 'success' | 'error';
  statusCode: number;
  errorCode: string | null;
  errorMessage: string | null;
  ip: string;
  userAgent: string | null;
  durationMs: number;
}

export interface GymAuditQuery {
  from?: string;
  to?: string;
  actorId?: string;
  actorEmail?: string;
  entity?: string;
  targetUserId?: string;
  result?: 'success' | 'error';
  verb?: GymAuditLog['verb'];
  q?: string;
  cursor?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly api = inject(ApiClient);

  list(query: GymAuditQuery) {
    return this.api
      .get<{ items: GymAuditLog[]; nextCursor: string | null }>('/gym/audit-logs', { limit: 100, ...query })
      .pipe(map((r) => ({ items: unwrapList<GymAuditLog>(r.data), nextCursor: r.data?.nextCursor ?? null })));
  }
}
