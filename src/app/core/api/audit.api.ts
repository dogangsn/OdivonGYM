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
  /** `system`: iyzico ile yapılan online ödeme gibi otomatik işlemler. */
  actorType: 'staff' | 'member' | 'system';
  method: string;
  route: string;
  entity: string;
  moduleLabel: string;
  verb: 'create' | 'update' | 'delete' | 'action';
  label: string;
  entityId: string | null;
  targetUserId: string | null;
  memberIds?: string[];
  request: unknown;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  /** Üye dışı bir işlemin (paket satışı, borç ödemesi, tavsiye ödülü…) üye kaydında değiştirdikleri, üye id'sine göre. */
  memberChanges?: Record<string, Record<string, { from: unknown; to: unknown }>> | null;
  outcome?: unknown;
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

/** Üye geçmişi satırı: IP / tarayıcı bilgisi ve hatalı denemeler gelmez. */
export type MemberHistoryEntry = Omit<GymAuditLog, 'ip' | 'userAgent' | 'errorMessage'>;

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly api = inject(ApiClient);

  list(query: GymAuditQuery) {
    return this.api
      .get<{ items: GymAuditLog[]; nextCursor: string | null }>('/gym/audit-logs', { limit: 100, ...query })
      .pipe(map((r) => ({ items: unwrapList<GymAuditLog>(r.data), nextCursor: r.data?.nextCursor ?? null })));
  }

  /** Tek üyenin geçmişi (üye görme yetkisi yeter), en yeni önce. */
  memberHistory(memberId: string, before?: string) {
    return this.api
      .get<{ items: MemberHistoryEntry[]; nextBefore: string | null }>(`/gym/members/${memberId}/history`, {
        limit: 100,
        ...(before ? { before } : {}),
      })
      .pipe(map((r) => ({ items: r.data?.items ?? [], nextBefore: r.data?.nextBefore ?? null })));
  }
}
