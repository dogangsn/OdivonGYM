import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';

/** Odivon yönetim panelinden (İşletme Bildirimleri) işletmeye gönderilen duyuru. */
export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'success' | 'warning' | 'critical';
  link: string | null;
  linkLabel: string | null;
  createdAt: string;
  expiresAt: string | null;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlatformNotificationsApi {
  private readonly api = inject(ApiClient);

  list(limit = 30) {
    return this.api
      .get<{ items: PlatformNotification[]; unreadCount: number }>('/notifications/platform', { limit }, { skipLoading: true })
      .pipe(map((r) => r.data?.items ?? []));
  }

  markRead(id: string) {
    return this.api.post<{ ok: boolean }>(`/notifications/platform/${encodeURIComponent(id)}/read`, {}, { skipLoading: true });
  }

  markAllRead() {
    return this.api.post<{ ok: boolean }>('/notifications/platform/read-all', {}, { skipLoading: true });
  }
}
